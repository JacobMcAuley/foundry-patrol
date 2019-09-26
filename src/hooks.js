Hooks.on('init', () => game.settings.register(PATROLCONFIG.module, PATROLCONFIG.key, PATROLCONFIG.settings));

Hooks.on('renderTokenHUD', (app, html, data) => tokenHUDPatrol(app,html,data));

Hooks.on('canvasInit', () => {
    Token.prototype.routes = null;
    let tokens = canvas.tokens.ownedTokens;
    for(let i = 0; i < tokens.length; i++){ 
        if(tokens[i].data.flags["foundry-patrol"] == null){
            setProperty(tokens[i].data, "flags.foundry-patrol.routes", {});
            tokens[i].update(canvas.scene.id, JSON.parse(JSON.stringify(tokens[i].data))) // I couldn't think of how to do this and then I saw Felix' solution. Thanks!   
        }
        if(tokens[i].routes == null)
        {
            tokens[i].routes = new Patrols(tokens[i]);
        }
    }
});

Hooks.on('createToken', function(token, sceneId, data){
    token.routes = new Patrols(token);
})

Hooks.on("preCreateToken", (actorId, createData, options) => {
    setProperty(options, "flags.foundry-patrol.routes", {});
});

Hooks.on("deleteToken",(token, sceneId, options) =>{
    token.routes.isDeleted = true;
})