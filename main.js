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
            plots: [plots],
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
    
    async generateRoute(tokenId, plots){
        tokenId -= 1;
        await this._doesSceneExist();
        await this._doesTokenExist(tokenId);
        await this._addTokenPatrol(tokenId, plots);
        this.saveData()
    }

    getFullSet(){
        console.log(this.patrolRoute);
    }

}

Hooks.on('ready', async function(app, data, html){

    let tokenLayer = canvas.tokens;

    let tokenOne = tokenLayer.ownedTokens[0];
    let tokenTwo = tokenLayer.ownedTokens[1];
    
    
    let tokenTrans = tokenOne.transform;
    
    console.log(tokenTrans.position.local);
    
    let plot = {
        x: 1500,
        y: 1800
    }
    
    
    await tokenOne.setPosition(plot.x, plot.y);
    tokenOne.update("qbolHL1dtyc1tMig", plot)
})
