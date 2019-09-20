class Patrols{
    constructor(data = null){
        if(data == null)
        {
            localStorage.setItem('patrol', JSON.stringify({}))
            this.patrolRoute = JSON.parse(localStorage.getItem('patrol'));
        }
        else
        {
            this.patrolRoute = JSON.parse(localStorage.getItem('patrol'));
        }
    }
    
    saveData(){
        localStorage.setItem('patrol', JSON.stringify(this.patrolRoute));
    }



    _generateScene(){
        let sceneId = canvas.id;
        this.patrolRoute[sceneId] = [];
        return true
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
                    await _generateScene()
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
                if(this.patrolRoute[sceneId].length >= tokenId){
                    resolve(true);
                }
                else{
                    this._generateToken(tokenId)
                }
            } 
            catch(error){
                reject(error);
            }

        })
    }

    addTokenPatrol(tokenId, plots){ // Token id not needed? Relational?
        return new Promise((resolve, reject) => {
            try{
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
        await this._doesSceneExist();
        await this._doesTokenExist(tokenId);
        await this.addTokenPatrol(tokenId, plots);
    }

    getFullSet(){
        console.log(this.patrolRoute);
    }

}








var test = {
    "qbolHL1dtyc1tMig" : [
        
    ]
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
    
    
    //pathing.qbolHL1dtyc1tMig[tokenOne] = {}
    
    await tokenOne.setPosition(plot.x, plot.y);
    tokenOne.update("qbolHL1dtyc1tMig", plot)

    //test.qbolHL1dtyc1tMig.push(tokenOne)

    //test.qbolHL1dtyc1tMig.find(p => p === tokenOne)    
})


/*

localStorage.setItem('patrol', JSON.stringify(test));

var tokenTest = JSON.parse(localStorage.getItem('patrol'));

console.log(tokenTest);
{
    sceneId : 
    [
        tokenId :
        {
            plots = [{x,y}, {x,y}]
            inverse = true/false
            enabled = true/false
        }
    ]

}


*/