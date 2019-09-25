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


class Patrols{
    constructor(token, debug = true){
        this.debug = debug;
        this.isWalking = false;
        this.sceneId = canvas.id;
        this.token = token;
        this.patrolRoute = this.token.data.flags['foundry-patrol'].routes;
        this.lastRecordedLocation = {
            x : getProperty(this.token.data, "x"),
            y : getProperty(this.token.data, "y")
        }
        this.delayPeriod = 2000;
        if(this.debug) console.log("Foundry-Patrol: Creating");
    }

    addPlotPoint(data){
        this.generateRoute({x: this.token.transform.position._x, y: this.token.transform.position._y,});
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
            inverse: true,
            enabled: false,
            lastPos: 0
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
        let patrolPoints = this.getPlotsFromId;

        if(!patrolPoints){
            if(this.debug) console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
            
        while(this.isWalking && patrolPoints)
        {
            await this._navigationLoop();
        }
    }

    async _navigationLoop()
    {
        const sleep = m => new Promise(r => setTimeout(r, m));
        let patrolPoints = this.getPlotsFromId;

        for(let i = 0; i < patrolPoints.length; i++){
            console.log("Quick")
            await sleep(this.delayPeriod);
            if(this.isWalking && !game.paused && this._validatePatrol()){
                await this._navigateToNextPoint(patrolPoints[i]);
            }
            else{
                this.isWalking = false;
                break;
            }
        }
    }

    _validatePatrol(){
        try{
            if(this.lastRecordedLocation.x != getProperty(this.token.data, "x") || this.lastRecordedLocation.y != getProperty(this.token.data, "y")){
                return false;
            }
            return true;
        }
        catch(error){
            if(this.debug) console.log(`Foundry-patrol: Error in validating patrol status -> \n ${error}`);
            return false
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
            title: "Patrol Start",
            content: "<p></p>",
            buttons: {
             one: {
              icon: '<i class="fas fa-check"></i>',
              label: "Confirm: Delete this token's stored routes",
              callback: () => this._deleteRoutes()
             }, 
             two: {
                icon: '<i class="fas fa-check"></i>',
                label: "Reject: I do not want to delete",
                callback: () => console.log("Foundry-Patrol: Mind changed, nothing deleted")
             }
            },
            default: "Ack",
            close: () => console.log("Foundry-Patrol: Prompt Closed")
        });
        deletePrompt.render(true);
    }

    _deleteRoutes(){
        this.isWalking == false;
        this.patrolRoute[this.sceneId] = {};
        this._updateToken();
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

    get isPatrolling(){
        return this.isWalking;
    }
    
    get getDelayPeriod(){
        return this.delayPeriod/1000;
    }
   

    get getAllRoutes(){
        return this.patrolRoute;
    }

    
}

function tokenHUDPatrol(app, html, data){
    let token = app.object;
    let isPatrolling = token.routes.isPatrolling;

    const plotDiv = $(`
        <div class="plotDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 48px;">\
        </div>
    `);

    const addPlotPoint = $(`
        <div class="control-icon" style="margin-left: 4px;"> \ 
            <img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"> \
        </div>
    `);

    const deletePlotPoint = $(`
        <div class="control-icon" style="margin-left: 4px;"> \ 
            <i class="fas fa-trash-alt"></i> \
        </div>
    `);

    const inversePlotDirection = $(`
        <div class="control-icon" style="margin-left: 4px;"> \ 
            <i class="fas fa-recycle"></i> \
        </div>
    `);

    const patrolDiv = $(`
        <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 7px;">\
        </div>
    `);
    
    var patrolWalkHUD = $(`<i class="fas fa-walking title control-icon" style="margin-left: 4px;"></i>`)
    
    if(isPatrolling == true){
        patrolWalkHUD = $(`<i class="fas fa-times title control-icon" style="margin-left: 4px;"></i>`)
    }
    
    const patrolDelayHUD = $(`<input class="control-icon"  style="margin-left: 4px;" type="text" id="patrolWait" value=${token.routes.getDelayPeriod} name="patrolWait">`)

    if(game.user.isGM || game.settings.get("foundry-patrol", "enablePlayerPatrol"))
    {
        html.find('.left').append(plotDiv);
        html.find('.plotDiv').append(addPlotPoint);
        html.find('.plotDiv').append(deletePlotPoint);
        html.find('.plotDiv').append(inversePlotDirection);
        html.find('.left').append(patrolDiv);
        html.find('.patrolDiv').append(patrolWalkHUD);
        html.find('.patrolDiv').append(patrolDelayHUD);

        addPlotPoint.click(ev => {
            token.routes.addPlotPoint(app);
            pointAdded.render(true);
        });

        deletePlotPoint.click(ev => {
            token.routes.deleteProcess();
        });

        patrolWalkHUD.click(ev => {
            var className = ev.target.getAttribute("class");
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