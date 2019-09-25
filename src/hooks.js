Hooks.on('init', () => game.settings.register(PATROLCONFIG.module, PATROLCONFIG.key, PATROLCONFIG.settings));

Hooks.on('renderTokenHUD', (app, html, data) => tokenHUDPatrol(app,html,data));

Hooks.on('canvasInit', () => {
    Token.prototype.routes = null;
    let tokens = canvas.tokens.ownedTokens;
    for(let i = 0; i < tokens.length; i++){
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