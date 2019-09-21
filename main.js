var GLOBALROUTEVAR = null;

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
        if(localStorage.getItem('patrol') == null)
        {
            if(DEBUG)
                console.log("Foundry-Patrol: Generating new storage")
            localStorage.setItem('patrol', JSON.stringify({}))
            this.patrolRoute = JSON.parse(localStorage.getItem('patrol'));
        }
        else
        {
            if(DEBUG)
                console.log("Foundry-Patrol: Loading old storage")
            this.patrolRoute = JSON.parse(localStorage.getItem('patrol'));
        }
    }
    
    saveData(){
        if(DEBUG)
            console.log("Foundry-Patrol: Saving data")
        localStorage.setItem('patrol', JSON.stringify(this.patrolRoute));
    }



    _generateScene(){
        let sceneId = canvas.id;
        this.patrolRoute[sceneId] = [];
        return true;
    }

    _generateToken(tokenId){ // promise?
        let sceneId = canvas.id;
        let tokenRoutes = this.patrolRoute[sceneId]
        let tokenInfo = {
            plots: [],
            inverse: true,
            enabled: false
        }
        tokenRoutes.push(tokenInfo);
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

    _doesTokenExist(tokenId){
        return new Promise(async (resolve, reject) => {
            try{
                let sceneId = canvas.id;
                if(this.patrolRoute[sceneId].length >= (tokenId+1)){
                    resolve(true);
                }
                else{
                    this._generateToken(tokenId)
                    resolve(true);
                }
            } 
            catch(error){
                reject(error);
            }

        })
    }

    _addTokenPatrol(tokenId, plots){ // Token id not needed? Relational?
        return new Promise((resolve, reject) => {
            try{
                let sceneId = canvas.id;
                let plotPoints = this.patrolRoute[sceneId][tokenId].plots
                
                plotPoints.push({x: plots.x, y: plots.y})

                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }
    
    async _navigateToNextPoint(plot){
        let token = canvas.tokens.ownedTokens[0];
        await token.setPosition(plot.x, plot.y);
        token.update(canvas.id, plot)
    }

    _getPlotsFromId(tokenId){
        tokenId -= 1;
        let sceneId = canvas.id;
        return this.patrolRoute[sceneId][tokenId].plots   
    }

    async startPatrol(data){
        let token = data.object;
        let patrolPoints = this._getPlotsFromId(token.id);
        for(let patrolStop in patrolPoints){
            console.log(patrolStop);
        }
        await this._navigateToNextPoint(patrolPoints[1]);
    }

    addPlotPoint(data){
        let token = data.object;
        this.generateRoute(token.id , {x: token.transform.position._x, y: token.transform.position._y,})
        console.log(token);
    }

    async generateRoute(tokenId, plots){
        tokenId -= 1;
        await this._doesSceneExist();
        await this._doesTokenExist(tokenId);
        await this._addTokenPatrol(tokenId, plots);
        this.saveData()
    }

    get getFullSet(){
        console.log(this.patrolRoute);
    }

}




Hooks.on('renderTokenHUD', (app, html, data) => {
    console.log("Test");
    const importButton = $('<div class="control-icon visibility"><img src="icons/svg/clockwork.svg" width="36" height="36" title="mark-point"></div>');
    const importButton2 = $('<div class="control-icon visibility"><i class="fas fa-walking title="start-patrol""></i></div>');

    html.find('.left').append(importButton);
    html.find('.left').append(importButton2);
    importButton.click(ev => {
        GLOBALROUTEVAR.addPlotPoint(app);
        pointAdded.render(true);
    });
    importButton2.click(ev => {
        GLOBALROUTEVAR.startPatrol(app)
        //playlistPrompt.render(true);
    });
});

Hooks.on('ready', async function(app, data, html){
    GLOBALROUTEVAR = new Patrols();
})
