let pointAdded = new Dialog({
    title: "Point Added",
    content: "<p>A point has been added to the route</p>",
    buttons: {
     one: {
      icon: '<i class="fas fa-check"></i>',
      label: "Close",
      callback: () => console.log("Close")
     }
    },
    default: "Ack",
    close: () => console.log("Playlist-Importer: Prompt Closed")
});


class Patrols{
    constructor(debug = false){
        this.debug = debug;
        this.isWalking = false;
        this.patrolRoute = {};
        console.log("Foundry-Patrol: Creating")
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

                let plotPoints = this.patrolRoute[sceneId].plots
                
                plotPoints.push({x: plots.x, y: plots.y})

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
            token.update(canvas.id, plot)
        }
        catch(error){
            console.log(error);
        }
    }

    _getPlotsFromId(){
        let sceneId = canvas.id;
        return this.patrolRoute[sceneId].plots   
    }

    
    async startPatrol(data){
        this.isWalking = !this.isWalking;
        const sleep = m => new Promise(r => setTimeout(r, m))
        let token = data.object;
        let patrolPoints = this._getPlotsFromId();
        while(this.isWalking)
        {
            for(let i = 0; i < patrolPoints.length; i++){
                await sleep(1500);
                if(this.isWalking){
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
        this.generateRoute({x: token.transform.position._x, y: token.transform.position._y,})
        console.log(token);
    }

    async generateRoute(plots){
        await this._doesSceneExist();
        await this._addTokenPatrol(plots);
    }

    getFullSet(){
        return this.patrolRoute;
    }

}

Hooks.on('renderTokenHUD', (app, html, data) => {
    const importButton = $('<div class="control-icon visibility"><img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"></div>');
    const importButton2 = $('<div class="control-icon visibility"><i class="fas fa-walking title="start-patrol""></i></div>');
    let token = app.object;
    console.log(token);
    html.find('.left').append(importButton);
    html.find('.left').append(importButton2);
    importButton.click(ev => {
        token.routes.addPlotPoint(app);
        pointAdded.render(true);
    });
    importButton2.click(ev => {
        token.routes.startPatrol(app)
        //playlistPrompt.render(true);
    });
});

Hooks.on('ready', () => {
    Token.prototype.routes = null;
    let tokens = canvas.tokens.ownedTokens;
    for(let i = 0; i < tokens.length; i++){
        tokens[i].routes = new Patrols();
    }
});

Hooks.on('createToken', async function(parentId, createData, option){
    parentId.routes = new Patrols();
    console.log(parentId.routes);
})

