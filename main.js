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
    constructor(debug = true){
        this.debug = debug;
        this.isWalking = false;
        this.patrolRoute = {};
        console.log("Foundry-Patrol: Creating");
    }

    _generateScene(){
        let sceneId = canvas.id;
        this.patrolRoute[sceneId] = {
            plots: [],
            inverse: true,
            enabled: false
        }
        return true;
    }

    _doesSceneExist(){
        return new Promise(async (resolve, reject) => {
            try{
                let sceneId = canvas.id; 
                if(this.patrolRoute[sceneId] == null){
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
                let sceneId = canvas.id;

                console.log(this.patrolRoute[sceneId]);

                let plotPoints = this.patrolRoute[sceneId].plots;
                
                plotPoints.push({x: plots.x, y: plots.y});

                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }
    
    async _navigateToNextPoint(plot, token){
        try{
            await token.setPosition(plot.x, plot.y);
            token.update(canvas.id, plot);
        }
        catch(error){
            console.log(error);
        }
    }

    _getPlotsFromId(){
        try{
            let sceneId = canvas.id;
            return this.patrolRoute[sceneId].plots; 
        }
        catch(error){
            if(this.debug)
                console.log(`Foundry-Patrol: ERROR -> ${error}`);
            return false;
        }
    }

    
    async startPatrol(data, delayPeriod){
        delayPeriod = delayPeriod * 1000; //Conversion to miliseconds.
        this.isWalking = !this.isWalking;
        const sleep = m => new Promise(r => setTimeout(r, m));
        let sceneId = canvas.id;
        let token = data.object;
        let patrolPoints = this._getPlotsFromId();
        if(!patrolPoints){
            console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
            
        while(this.isWalking && patrolPoints)
        {
            for(let i = 0; i < patrolPoints.length; i++){
                await sleep(delayPeriod);
                if(this.isWalking && (sceneId === canvas.id)){
                    this._navigateToNextPoint(patrolPoints[i], token);
                }
                else{
                    break;
                }
            }
        }
    }

    addPlotPoint(data){
        let token = data.object;
        this.generateRoute({x: token.transform.position._x, y: token.transform.position._y,});
        console.log(token);
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

    getFullSet(){
        return this.patrolRoute;
    }

}

function tokenHUDPatrol(app, html, data){
    
    const addPlotHUD = $(`
        <div class="control-icon"> \ 
            <img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"> \
        </div>`
    );

    const patrolDiv = $(`
        <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center;">\
        </div>
    `);

    const patrolWalkHUD = $(`<i class="fas fa-walking title control-icon"></i>`)
    const patrolDelayHUD = $(`<input class="control-icon" type="text" id="patrolWait" name="patrolWait">`)

    let token = app.object;
    console.log(token);
    html.find('.left').append(addPlotHUD);
    html.find('.left').append(patrolDiv);
    html.find('.patrolDiv').append(patrolWalkHUD);
    html.find('.patrolDiv').append(patrolDelayHUD);
    addPlotHUD.click(ev => {
        token.routes.addPlotPoint(app);
        pointAdded.render(true);
    });
    patrolWalkHUD.click(ev => {
        let delayPeriod = document.getElementById("patrolWait").value;
        token.routes.startPatrol(app, delayPeriod);
    });
}



Hooks.on('renderTokenHUD', (app, html, data) => tokenHUDPatrol(app,html,data));

Hooks.on('canvasInit', () => {
    Token.prototype.routes = null;
    let tokens = canvas.tokens.ownedTokens;
    for(let i = 0; i < tokens.length; i++){
        tokens[i].routes = new Patrols();
    }
});

Hooks.on('createToken', async function(parentId, createData, option){
    parentId.routes = new Patrols();
})
