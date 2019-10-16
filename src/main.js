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
        this.delayPeriod = [2000];
        this.isDeleted = false;

        this.drawnPlot = null;
        this.color = this._generateColor();
        this.selected = false;

        this.countinousRoutes = [];
        this.endCountinousRoutes = [];
    }

    _generateColor(){
        const HEX_LENGTH = 6;
        let options = "0123456789ABCDEF"
        let color = "0x";

        for(let i = 0; i < HEX_LENGTH; ++i){
            color += options[Math.floor(Math.random()* options.length)]
        }
        return color;
    } 

    async addPlotPoint(displayInfo = false){
        await this.generateRoute({x: getProperty(this.token.data, "x"), y: getProperty(this.token.data, "y")});
        if(displayInfo) this._addPlotDisplay();
        this.livePlotUpdate();
        //await this.linearWalk(); 
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
            ui.notifications.error("Foundry-Patrol: Critical Error! Please hit F12 and JacobMcAuley a message on discord");
            console.log(`Foundry-Patrol: -> Generate Route: \n${error}`);
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
                this._updatePatrol();
                let plotPoints = this.patrolRoute[this.sceneId].plots;
                plotPoints.push({x: plots.x, y: plots.y});
                resolve(true);
            } 
            catch(error){
                reject(error);
            }
        })
    }

    _updateToken(){
        this.token.update(this.sceneId, JSON.parse(JSON.stringify(this.token.data))) // I couldn't think of how to do this and then I saw Felix' solution. Thanks!
    }

    async startPatrol(delay){
        await this._handleDelayPeriod(delay);
        this._updatelastRecordedLocation();
        this.isWalking = !this.isWalking;
        let cycle = 0;
        while(this.isWalking && this._validatePatrol())
        {
            await this._navigationCycle(cycle);
            cycle++;
        }
        this._disableWalking();
    }

    async _handleDelayPeriod(delay){
        const MILLISECONDS = 1000;
        const DEFAULT_SECONDS = 2;
        const INVALID_NUMBER = 0;
        if(delay == null)
        {
            return
        }
        else{
            if(delay.match(/[^0-9&^\-&^\[&^\]&^\,&^\s]/g))
                return;

            delay = this._processDelayRegex(delay);
        }
        try{
            for(let i = 0; i < delay.length; ++i)
            {
                if(delay[i] <= INVALID_NUMBER)
                    delay[i] = (delay[i] * -1) + DEFAULT_SECONDS;
                delay[i] = delay[i] * MILLISECONDS;
            }
            this.delayPeriod = delay;
        }
        catch(error) { // Occurs in the event the user fails to properly pass values. Simply returning will use the previously stored delayPeriod.
            return;
        }
    }

    _processDelayRegex(delay){
        delay = delay.replace(/ /g,""); // Remove Space
        let singleValue = delay.match(/[0-9]+/g);
        
        let commaSeperated = delay.match(/(\d+(?=,)|(?<=,)\d+)/g); // Checks for values that are strictly digits followed or preceeded by commas.
        let rangeDelay = delay.match(/(\d+\-\d+)/g)
        delay = [];
        if(singleValue.length == 1){
            delay.push(parseInt(singleValue[0]));
            return delay;
        }
        if(rangeDelay){
            rangeDelay.forEach(function(rangeSet){
                let rangeValues = rangeSet.split('-');
                for(let i = parseInt(rangeValues[0]); i <= parseInt(rangeValues[1]); i++){
                    delay[delay.length] = i;
                }
            });
        };

        if(commaSeperated){
            commaSeperated.forEach(function(csvValue){
                delay[delay.length] = parseInt(csvValue);
            });     
        }        
        if(this.debug) console.log(`Foundry-Patrol: Wait periods include: ${delay}`);
        return delay;
    }

    async _navigationCycle(cycle)
    {
        const settings = {
            INCREMENT : 1,
            DECREMENT : -1,
            PLOT_SIZE : this.getPlotsFromId.length,
            RETURN_SIZE : [].length,
            ON_INVERSE_FALSE: false,
            ON_INVERSE_TRUE: true,
            OPERATOR_GREATER : function(a, b) {return a >= b},
            OPERATOR_LESS : function(a, b) {return a < b},
        }
        let patrolPoints = this.getPlotsFromId;
        //await this.linearWalk(true)
        //let patrolPoints =  this.countinousRoutes.concat(this.endCountinousRoutes); // [Fix plot.length -1] ---> [0]
        try{
            let lastPos = await this._determineLastPosition(cycle); 
            await this._navigationLoop(patrolPoints, lastPos, settings.PLOT_SIZE, settings.OPERATOR_LESS, settings.ON_INVERSE_FALSE, settings.INCREMENT);
            lastPos = await this._determineLastPosition(cycle);
            await this._navigationLoop(patrolPoints, lastPos, settings.RETURN_SIZE, settings.OPERATOR_GREATER, settings.ON_INVERSE_TRUE, settings.DECREMENT);
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error --> Token can not be referenced. Likely a massive delete ${error}`);
        }
    }

    async _navigationLoop(patrolPoints, iterator, comparison, operation, onReturn, increment){
        const sleep = m => new Promise(r => setTimeout(r, m));
        if(this.onInverseReturn == onReturn){
            for(iterator; operation(iterator, comparison); iterator = iterator + (increment)){
                await sleep(this.delayPeriod[Math.floor(Math.random() * this.delayPeriod.length)]);
                if(this.isWalking && !game.paused && !this._wasTokenMoved() && this._validatePatrol() && !this.isDeleted){
                    await this._navigateToNextPoint(patrolPoints[iterator]);
                    this._storeLastPlotTaken(iterator);
                }
                else{
                    if(game.paused == true){
                        iterator = --iterator;
                    }else{
                        this._disableWalking();
                        break;
                    }
                }
            }
            if(this.isInverted){
                this._setInverseReturn();
            }   
        }
    }

    async _determineLastPosition(cycle){
        let lastPos = this.patrolRoute[this.sceneId].lastPos;
        if(!this.isInverted){
            if(cycle != 0 && lastPos == this.getPlotsFromId.length - 1){
                return 0;
            }
            return lastPos;
        }
        else{
            return lastPos;
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

    async linearWalk(generateEnd = 0){
        let plot = await JSON.parse(JSON.stringify(this.getPlotsFromId));
        let len = plot.length - 1;
        if (generateEnd == 1)
        {
            const ROUTE_START = 0
            let xMod = (plot[ROUTE_START].x >= plot[len-1].x) ? 1 : -1;
            let yMod = (plot[ROUTE_START].y >= plot[len-1].y) ? 1 : -1; 
            //this.endCountinousRoutes.push(plot[len-1]);
            await this._generateLinearRoute(this.endCountinousRoutes, plot[len-1], plot[ROUTE_START], xMod, yMod);          
        }
        else if(len <= 0){
            this.countinousRoutes.push(plot[0]);
        }
        else{
            let xMod = (plot[len].x >= plot[len-1].x) ? 1 : -1;
            let yMod = (plot[len].y >= plot[len-1].y) ? 1 : -1; 
            await this._generateLinearRoute(this.countinousRoutes, plot[len-1], plot[len], xMod, yMod);
        }
    }

    async _generateLinearRoute(route, src, dest, xMod, yMod){
        console.log(route);
        const GRID_SIZE = canvas.grid.size;
        if(src.x == dest.x && src.y == dest.y)
        {
            return true;
        }
        else if(src.x != dest.x && src.y != dest.y)
        {
            src.x += GRID_SIZE * xMod;
            src.y += GRID_SIZE * yMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else if(src.x == dest.x && src.y != dest.y)
        {
            src.y += GRID_SIZE * yMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else if(src.x != dest.x && src.y == dest.y){
            src.x += GRID_SIZE * xMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else{
            if(this.debug) console.log("Foundry-Patrol: Error in generating Continuous route.");
        }
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
            this._updatePatrol();
            this.patrolRoute[this.sceneId].plots.length = 0;
            this.patrolRoute[this.sceneId].lastPos = 0;
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    _undoLast(){
        if(this.getPlotsFromId != false){
            this._updatePatrol();
            this.patrolRoute[this.sceneId].plots.pop();
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

    _disableWalking(){
        this.isWalking = false;
    }

    _updatePatrol(){
        this.patrolRoute = this.token.data.flags['foundry-patrol'].routes;
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
        let userDisplayDelay = []; // a more visually friendly format.
        for(let i = 0; i < this.delayPeriod.length; ++i){
            userDisplayDelay.push(this.delayPeriod[i]/1000);
        }
        return userDisplayDelay;
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
            <img src="modules/foundry-patrol/imgs/svg/map.svg" width="36" height="36" title="mark-point"> \
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