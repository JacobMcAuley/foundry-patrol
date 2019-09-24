window.addEventListener("unhandledrejection", function(promiseRejectionEvent) { 
    console.log("Test");
});

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
        this.delayPeriod = 2000;
        console.log("Foundry-Patrol: Creating");
    }

    _generateScene(){
        this.patrolRoute[this.sceneId] = {
            plots: [],
            inverse: true,
            enabled: false
        }
        return true;
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

    _addTokenPatrol(plots){ // Token id not needed? Relational?
        return new Promise((resolve, reject) => {
            try{
                console.log(this.patrolRoute[this.sceneId]);

                let plotPoints = this.patrolRoute[this.sceneId].plots;
                
                plotPoints.push({x: plots.x, y: plots.y});

                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }
    
    async _navigationLoop()
    {
        const sleep = m => new Promise(r => setTimeout(r, m));
        let patrolPoints = this._getPlotsFromId();

        for(let i = 0; i < patrolPoints.length; i++){
            await sleep(this.delayPeriod);
            if(this.isWalking && !game.paused){
                await this._navigateToNextPoint(patrolPoints[i]);
            }
            else{
                break;
            }
        }
    }

    async _navigateToNextPoint(plot){
        try{
            await this.token.update(this.sceneId, plot);
        }
        catch(error){
            console.log(`Foundry-Patrol: Error in token navigation\n${error}`);
        }
    }

    _getPlotsFromId(){
        try{
            return this.patrolRoute[this.sceneId].plots; 
        }
        catch(error){
            if(this.debug)
                console.log(`Foundry-Patrol: ERROR -> ${error}`);
            return false;
        }
    }

    
    async startPatrol(userDelayPeriod){
        (userDelayPeriod == 0) ? this.delayPeriod: this.delayPeriod = userDelayPeriod * 1000; //Defaults to previous.
        this.isWalking = !this.isWalking;
        let patrolPoints = this._getPlotsFromId();

        if(!patrolPoints){
            console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
            
        while(this.isWalking && patrolPoints)
        {
            await this._navigationLoop();
        }
    }

    addPlotPoint(data){
        this.generateRoute({x: this.token.transform.position._x, y: this.token.transform.position._y,});
        console.log(this.token);
    }

    async generateRoute(plots){
        try{
            await this._doesSceneExist();
            await this._addTokenPatrol(plots);
        }catch(error){
            console.log(error);
            return error;
        }
    }

    get isPatrolling(){
        return this.isWalking;
    }
    
    get getDelayPeriod(){
        return this.delayPeriod/1000;
    }

    getFullSet(){
        return this.patrolRoute;
    }

}

function tokenHUDPatrol(app, html, data){
    let token = app.object;
    let isPatrolling = token.routes.isPatrolling;
    console.log(isPatrolling);
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
            <img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"> \
        </div>
    `);

    const patrolDiv = $(`
        <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center;">\
        </div>
    `);
    
    var patrolWalkHUD = $(`<i class="fas fa-walking title control-icon"></i>`)
    
    if(isPatrolling == true){
        console.log("Here");
        patrolWalkHUD = $(`<i class="fas fa-times title control-icon"></i>`)
    }
    
    const patrolDelayHUD = $(`<input class="control-icon" type="text" id="patrolWait" value=${token.routes.getDelayPeriod} name="patrolWait">`)
    //<i class="fas fa-times"></i>
    
    console.log(token);
    
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
        let delayPeriod = document.getElementById("patrolWait").value;
        token.routes.startPatrol(delayPeriod);
    });
}