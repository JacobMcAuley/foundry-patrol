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

Hooks.on('createToken', async function(parentId, createData, option){
    parentId.routes = new Patrols(parentId);
})
