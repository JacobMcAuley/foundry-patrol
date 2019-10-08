class Patrols{
    constructor(token, debug = true){
        this.debug = debug;
        if(this.debug) console.log("Foundry-Patrol: Creating");

        this.isWalking = false;
        this.sceneId = canvas.id;
        this.inverted = false;
        this.token = token;
        this.patrolRoute = this.token.data.flags['foundry-patrol'].routes;
        this.lastRecordedLocation = {
            x : getProperty(this.token.data, "x"),
            y : getProperty(this.token.data, "y")
        }
        this.delayPeriod = 2000;
        this.isDeleted = false;

        this.drawnPlot = null;
        this.color = this._generateColor();
        this.selected = false;
    }

    _generateColor(){
        let options = "0123456789ABCDEF"
        let color = "0x";
        for(let i = 0; i < 6; ++i){
            color += options[Math.floor(Math.random()* 16)]
        }
        return color;
    } 

    async addPlotPoint(displayInfo = false){
        await this.generateRoute({x: getProperty(this.token.data, "x"), y: getProperty(this.token.data, "y")});
        if(displayInfo) this._addPlotDisplay();
        await this.livePlotUpdate();
    }

    _addPlotDisplay(){
        let pointAdded = new Dialog({
            title: "Point Added",
            content: "<p>A point has been added to the route</p>",
            buttons: {
             one: {
              icon: '<i class="fas fa-check"></i>',
              label: "Close",
              callback: () => console.log("Foundry-Patrol: Prompt Closed")
             }
            },
            default: "Ack",
            close: () => console.log("Foundry-Patrol: Prompt Closed")
        });        
        pointAdded.render(true);
    }

    async generateRoute(plots){
        try{
            await this._doesSceneExist();
            await this._addTokenPatrol(plots);
            this._updateToken();
        }catch(error){
            if(this.debug) console.log(`Foundry-Patrol: ${error}`);
            return error;
        }
    }

    _doesSceneExist(){
        return new Promise(async (resolve, reject) => {
            try{
                if(this.patrolRoute[this.sceneId] == null){
                    this._generateScene();
                    resolve(false);
                }
                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }

    _generateScene(){
        this.patrolRoute[this.sceneId] = {
            plots: [],
            enabled: false,
            lastPos: 0,
            onInverseReturn: false
        }
        return true;
    }

    _addTokenPatrol(plots){ 
        return new Promise((resolve, reject) => {
            try{
                let plotPoints = this.patrolRoute[this.sceneId].plots;
                plotPoints.push({x: plots.x, y: plots.y});
                if(this.debug) console.log(this.patrolRoute[this.sceneId]);
                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }

    _updateToken(){
        this.token.update(this.sceneId, JSON.parse(JSON.stringify(this.token.data))) // I couldn't think of how to do this and then I saw Felix' solution. Thanks!
        return true;    
    }

    async startPatrol(userDelayPeriod){
        this._updatelastRecordedLocation();
        (userDelayPeriod == 0) ? this.delayPeriod: this.delayPeriod = userDelayPeriod * 1000; //Defaults to previous.
        this.isWalking = !this.isWalking;
        while(this.isWalking && this._validatePatrol())
        {
            await this._navigationLoop();
        }
        this.isWalking = false;
    }

    async _navigationLoop()
    {
        const sleep = m => new Promise(r => setTimeout(r, m));
        let patrolPoints = this.getPlotsFromId;
        let lastPos = this._determineLastPosition();

        if(!this.onInverseReturn){
            for(let i = lastPos; i < patrolPoints.length; i++){
                await sleep(this.delayPeriod);
                if(this.isWalking && !game.paused && !this._wasTokenMoved() && this._validatePatrol() && !this.isDeleted){
                    await this._navigateToNextPoint(patrolPoints[i]);
                }
                else{
                    if(game.paused == true){
                        i = --i;
                    }else{
                        this.isWalking = false;
                        break;
                    }
                }
                this._storeLastPlotTaken(i);
            }    
        }

        if(this.isInverted)
        {
            this._setInverseReturn();
            lastPos = this._determineLastPosition();
            for(let i = lastPos; i >= 0; i--){
                await sleep(this.delayPeriod);
                if(this.isWalking && !game.paused && !this._wasTokenMoved() && this._validatePatrol() && !this.isDeleted){
                    console.log(`Inv: ${i}`);
                    await this._navigateToNextPoint(patrolPoints[i]);
                }
                else{
                    if(game.paused == true){
                        i = --i;
                    }else{
                        this.isWalking = false;
                        break;
                    }
                }
                this._storeLastPlotTaken(i);
            }
            this._setInverseReturn();    
        }

    }

    async _navigateToNextPoint(plot){
        try{
            await this.token.update(this.sceneId, plot);
            this._updatelastRecordedLocation(plot);
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error in token navigation\n${error}`);
        }
    }

    _determineLastPosition(){
        let patrolPoints = this.getPlotsFromId;
        let lastPos = this.lastPos + 1;
        if(!this.onInverseReturn){
            if(lastPos >= patrolPoints.length){
                lastPos = 0;
                return lastPos;
            }
            return lastPos;
        }
        if(this.lastPos == 0){
            this._setInverse();
            return this.lastPos;
        }
        return this.lastPos - 1;
    }

    _wasTokenMoved(){
        try{
            if(this.lastRecordedLocation.x != getProperty(this.token.data, "x") || this.lastRecordedLocation.y != getProperty(this.token.data, "y")){
                return true;
            }canvas
            return false;
        }
        catch(error){
            if(this.debug) console.log(`Foundry-patrol: Error in validating patrol status -> \n ${error}`);
            return true;
        }
        
    }

    _validatePatrol(){
        let patrolPoints = this.getPlotsFromId;
        if(!patrolPoints || patrolPoints.length == 0){
            if(this.debug) console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
        return true;
    }

    _storeLastPlotTaken(plotNumber){
        this.patrolRoute[this.sceneId].lastPos = plotNumber;
        this._updateToken();
    }

    _updatelastRecordedLocation(futurePlot){
        if(futurePlot != undefined){
            this.lastRecordedLocation.x = futurePlot.x;
            this.lastRecordedLocation.y = futurePlot.y;
        }
        else{
            this.lastRecordedLocation.x = getProperty(this.token.data, "x");
            this.lastRecordedLocation.y = getProperty(this.token.data, "y");
        }
    }


    deleteProcess(){
        let deletePrompt = new Dialog({
            title: "Patrol Delete",
            buttons: {
             one: {
              icon: '<i class="fas fa-check"></i>',
              label: "Confirm: Yes, delete all",
              callback: () => this._deleteRoutes()
             }, 
             two: {
                icon: '<i class="fas fa-undo"></i>',
                label: "Undo: Yes, but undo last",
                callback: () => this._undoLast()
             },
             three: {
                icon: '<i class="fas fa-times"></i>',
                label: "Reject: I do not want to delete",
                callback: () => console.log("Foundry-Patrol: Mind changed, nothing deleted")
             },
            },
            default: "Ack",
            close: () => console.log("Foundry-Patrol: Prompt Closed")
        });
        deletePrompt.render(true);
    }

    _deleteRoutes(){
        if(this.getPlotsFromId != false){
            this.isWalking == false;
            this.patrolRoute[this.sceneId].plots.length = 0;
            console.log(this.patrolRoute);
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    _undoLast(){
        if(this.getPlotsFromId != false){
            this.patrolRoute[this.sceneId].plots.pop();
            console.log(this.patrolRoute);
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    _setInverse(){
        this.inverted = !this.inverted;
    }

    _setInverseReturn(){
        this.patrolRoute[this.sceneId].onInverseReturn = !this.patrolRoute[this.sceneId].onInverseReturn;
        this._updateToken();
    }

    displayPlot(){
        let flags = canvas.scene.data.flags;
        if(this.getPlotsFromId.length > 0){
            this.drawnPlot = new drawRoute({
                points: this.getPlotsFromId, 
                dash: 25,
                gap: 25,
                offset: 750,
                color : this.color
            });
            flags.routes.push(this.drawnPlot);
            canvas.scene.update({flags: flags});
        }
    }

    removePlot(){
        let flags = canvas.scene.data.flags;
        let tempPlot = this.drawnPlot
        let plotIndex = flags.routes.findIndex(function(element){
            return element == tempPlot;
        })
        if(plotIndex != -1){
            flags.routes.splice(plotIndex, 1);
            canvas.scene.update({flags: flags});
        }
    }

    livePlotUpdate(){
        this.removePlot();
        canvas.layers[GLOBAL_ROUTES_INDEX].deactivate();
        this.displayPlot();
        canvas.layers[GLOBAL_ROUTES_INDEX].draw();
    }

    isSelected(){
        let flags = canvas.scene.data.flags;
        this.selected = !this.selected;
        if(this.selected){
            flags["selected"].push(this);
            canvas.scene.update({flags: flags});
        }
        else{
            flags["selected"].pop(); // Adjust in the future to handle multiple
            canvas.scene.update({flags: flags});
        }
    }

    get getPlotsFromId(){
        try{
            return this.patrolRoute[this.sceneId].plots; 
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: ERROR -> ${error}`);
            return false;
        }
    }

    get isInverted(){
        return this.inverted;
    }

    get onInverseReturn(){
        return this.patrolRoute[this.sceneId].onInverseReturn;
    }

    get isPatrolling(){
        return this.isWalking;
    }
    
    get getDelayPeriod(){
        return this.delayPeriod/1000;
    }
   
    get lastPos(){
        return this.patrolRoute[this.sceneId].lastPos
    }

    get getAllRoutes(){
        return this.patrolRoute;
    }
}

function tokenHUDPatrol(app, html, data){
    let token = app.object;
    let isPatrolling = token.routes.isPatrolling;
    let isInverted = token.routes.isInverted;

    const plotDiv = $(`
        <div class="plotDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 48px;">\
        </div>
    `);

    const addPlotPoint = $(`
        <div class="control-icon" style="margin-left: 4px;"> \ 
            <img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"> \
        </div>
    `);

    const deletePlotPoint = $(`<i class="control-icon fas fa-trash-alt" style="margin-left: 4px;"></i>`);

    var plotDirection = $(`<i class="control-icon fas fa-recycle" style="margin-left: 4px;"></i>`);

    if(isInverted){
        plotDirection = $(`<i class="control-icon fas fa-arrows-alt-h" style="margin-left: 4px;"></i>`);
    }

    const patrolDiv = $(`
        <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 7px;">\
        </div>
    `);
    
    var patrolWalkHUD = $(`<i class="fas fa-walking title control-icon" style="margin-left: 4px;"></i>`)
    
    if(isPatrolling){
        patrolWalkHUD = $(`<i class="fas fa-times title control-icon" style="margin-left: 4px;"></i>`)
    }
    
    const patrolDelayHUD = $(`<input class="control-icon"  style="margin-left: 4px;" type="text" id="patrolWait" value=${token.routes.getDelayPeriod} name="patrolWait">`)

    if(game.user.isGM || game.settings.get("foundry-patrol", "enablePlayerPatrol"))
    {
        html.find('.left').append(plotDiv);
        html.find('.plotDiv').append(addPlotPoint);
        html.find('.plotDiv').append(deletePlotPoint);
        html.find('.plotDiv').append(plotDirection);
        html.find('.left').append(patrolDiv);
        html.find('.patrolDiv').append(patrolWalkHUD);
        html.find('.patrolDiv').append(patrolDelayHUD);

        addPlotPoint.click(ev => {
            token.routes.addPlotPoint();
        });

        deletePlotPoint.click(ev => {
            token.routes.deleteProcess();
        });

        plotDirection.click(ev => {
            let className = ev.target.getAttribute("class");
            if(className == "control-icon fas fa-arrows-alt-h"){
                ev.target.className = "control-icon fas fa-recycle"

            }else{
                ev.target.className = "control-icon fas fa-arrows-alt-h"
            } 
            token.routes._setInverse();
        })

        patrolWalkHUD.click(ev => {
            let className = ev.target.getAttribute("class");
            if(className == "fas fa-walking title control-icon"){
                ev.target.className = "fas fa-times title control-icon"
            }else{
                ev.target.className = "fas fa-walking title control-icon"
            }
            let delayPeriod = document.getElementById("patrolWait").value;
            token.routes.startPatrol(delayPeriod);
        });
    }
}