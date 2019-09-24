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
        this.patrolRoute = {};
        this.token = token;
        this.lastRecordedLocation = {
            x : this.token.position._x,
            y : this.token.position._y
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
                    resolve(true);
                }
                resolve(false);
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
            enabled: false
        }
        return true;
    }



    _addTokenPatrol(plots){ // Token id not needed? Relational?
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
        let currentPosition = this.token.position;
        if(this.lastRecordedLocation.x != currentPosition._x || this.lastRecordedLocation.y != currentPosition._y){
            return false;
        }
        return true;
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
            let currentPosition = this.token.position;
            this.lastRecordedLocation.x = currentPosition._x;
            this.lastRecordedLocation.y = currentPosition._y;
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
        <div class="plotDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center;">\
        </div>
    `);

    const addPlotPoint = $(`
        <div class="control-icon"> \ 
            <img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"> \
        </div>
    `);

    const undoPlotPoint = $(`
        <div class="control-icon"> \ 
            <i class="fa fa-undo"></i> \
        </div>
    `);

    const patrolDiv = $(`
        <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center;">\
        </div>
    `);
    
    var patrolWalkHUD = $(`<i class="fas fa-walking title control-icon"></i>`)
    
    if(isPatrolling == true){
        patrolWalkHUD = $(`<i class="fas fa-times title control-icon"></i>`)
    }
    
    const patrolDelayHUD = $(`<input class="control-icon" type="text" id="patrolWait" value=${token.routes.getDelayPeriod} name="patrolWait">`)

    if(game.user.isGM || game.settings.get("foundry-patrol", "enablePlayerPatrol"))
    {
        html.find('.left').append(plotDiv);
        html.find('.plotDiv').append(addPlotPoint);
        html.find('.left').append(patrolDiv);
        html.find('.patrolDiv').append(patrolWalkHUD);
        html.find('.patrolDiv').append(patrolDelayHUD);
        addPlotPoint.click(ev => {
            token.routes.addPlotPoint(app);
            pointAdded.render(true);
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