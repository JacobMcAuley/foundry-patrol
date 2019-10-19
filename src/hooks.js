/**
 * Globals
 */
var GLOBAL_ROUTES_INDEX = null;
var ROUTE_LOGGER = null

/**
 * Register module setting enablePlayer. Settings can be found in ./config/config.js
 */
Hooks.on('init', () => {
    game.settings.register(PATROLCONFIG.module, PATROLCONFIG.key, PATROLCONFIG.settings)
});


/**
 * The custom layer "RoutesLayer" is initialized. A global index is set for future referencing.
 * Additionally, the key press detecting class, RoutesKeyLogger() is initalized. 
 */
Hooks.on('ready', () => {
    console.log(`Foundry-Patrol: Adding route -> ${canvas.stage.addChild(new RoutesLayer)}`);
    GLOBAL_ROUTES_INDEX = canvas.layers.findIndex(function(element){
        return element.constructor.name == "RoutesLayer"
    });
    ROUTE_LOGGER = new RoutesKeyLogger();
});

/**
 * Injects the custom TokenHud for patrolroutes.
 */
Hooks.on('renderTokenHUD', (app, html, data) => tokenHUDPatrol(app,html,data));


/**
 * Checks to see if a routes patrol data flag has already been created and generates if it hasn't.
 * 
 * After, adds a prototype to Token that takes the class Patrols. 
 * Following this, it iterates over all tokens to make sure that the token data flag for patrols is set. If it isn't generate
 * Then it adds a definition to Token.prototype.routes to Class Patrols if not already defined.
 */
Hooks.on('canvasInit', () => {
    let flags = canvas.scene.data.flags;
    if(flags.routes == null){
        flags.routes = [];
        canvas.scene.update({flags: flags});
    }

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

/**
 * New tokens are given Patrols
 */
Hooks.on('createToken', function(token, sceneId, data){
    token.routes = new Patrols(token);
})

/**
 * Tokens are given the property routes
 */
Hooks.on("preCreateToken", (actorId, createData, options) => {
    setProperty(options, "flags.foundry-patrol.routes", {});
});

/**
 * This is an attempt to halt a method to reduce errors when deleting tokens without halting the routes in progress.
 */
Hooks.on("deleteToken",(token, sceneId, options) =>{
    token.routes.isDeleted = true;
})

/**
 * This function allows for the drawing of set patrols routes when selecting an object. 
 * The GLOBAL_ROUTES_INDEX is required for this purpose.
 */
Hooks.on("controlToken", (object, controlled) => {
    if(controlled){
        object.routes.livePlotUpdate();
    }
    else{
        object.routes.removePlot();
        canvas.layers[GLOBAL_ROUTES_INDEX].deactivate();
        canvas.layers[GLOBAL_ROUTES_INDEX].draw();
    }
})