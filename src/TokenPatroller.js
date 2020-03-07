const TP = this.TP || {};

class TokenPatrollerInitalizer{
    constructor(){

    }

    static initialize(){
        TokenPatrollerInitalizer.hooksOnCanvasInit();
        TokenPatrollerInitalizer.hooksOnReady();
        TokenPatrollerInitalizer.hooksRenderTokenHUD();
        TokenPatrollerInitalizer.hooksControlToken();
        TokenPatrollerInitalizer.hooksDeleteToken();
    }

    static hooksOnCanvasInit(){
        Hooks.on('canvasInit', () => {
            if(!game.user.isGM)
                return;
            let flags = canvas.scene.data.flags;
            if(flags.routes == null){
                flags.routes = [];
                canvas.scene.update({flags: flags});
            }
        });
    }

    static hooksOnReady(){

        Hooks.on("ready", () => {
            if(!game.user.isGM)
                return;
            canvas.stage.addChild(new RoutesLayer);
            game.settings.register('foundry-patrol', 'drawnRoutes', {
                scope: 'world',
                default : [],
                type: Object
            });  
            TP.tokenPatroller = new TokenPatrollerManager();
            TP.routeLogger = new RoutesKeyLogger();
        })
    }
    
    static hooksRenderTokenHUD(){
        Hooks.on("renderTokenHUD", (tokenHUD, html, options) => {
            if(!game.user.isGM)
                return;
            TokenHud.HUD(tokenHUD.object, html, options);
        })
    }

    static hooksControlToken(){
        Hooks.on("controlToken", (object, controlled) => {
            if(!game.user.isGM)
                return;
            let tokenId = object.data._id;
            if(controlled){
                TP.tokenPatroller.livePlotUpdate(tokenId);
            }
            else{
                let GLOBAL_ROUTES_INDEX = canvas.layers.findIndex(function(element){
                    return element.constructor.name == "RoutesLayer"
                });
                TP.tokenPatroller._removePlotDrawing(tokenId);
                canvas.layers[GLOBAL_ROUTES_INDEX].deactivate();
                canvas.layers[GLOBAL_ROUTES_INDEX].draw();
            }
        })
    }

    static hooksDeleteToken(){
        Hooks.on("deleteToken",(scene, sceneId, tokenId) =>{
            TP.tokenPatroller.deleteToken(tokenId, sceneId);
        })
    }
}

class TokenPatrollerManager{
    constructor(){
        this.tokenMap = this.initializeHashTable();
        this.GLOBAL_ROUTES_INDEX = canvas.layers.findIndex(function(element){
            return element.constructor.name == "RoutesLayer"
        });
        this.debug = true;
    }

    initializeHashTable(){
        game.settings.register('foundry-patrol', "tokenRoutes", {
            scope: 'world',
            default: {},
            type: Object
        });
        return game.settings.get('foundry-patrol', 'tokenRoutes');
    }

    addPlotPoint(tokenId, token){
        let coord = {x: getProperty(token.data, "x"), y: getProperty(token.data, "y")}
        if(!coord)
            return;
        this.updateTokenRoute(tokenId, coord);
        this.livePlotUpdate(tokenId);
        this.linearWalk(false, tokenId);
        this.linearWalk(true, tokenId);
    }

    async startPatrol(delay, tokenId){
        delay = (delay) ? delay : this.delayPeriod;
        let token = canvas.tokens.get(tokenId); 
        await this._handleDelayPeriod(delay, tokenId);
        let patrolData = this.tokenMap[tokenId];
        this._updatelastRecordedLocation(undefined, token);
        patrolData.isWalking = !patrolData.isWalking;
        let cycle = (this.tokenMap[tokenId].inverted == false) ? 1 : 0;
        try{
            while(patrolData.isWalking && this._validatePatrol(token))
            {
                await this._navigationCycle(cycle, token);
                game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
                cycle = (this.tokenMap[tokenId].inverted == false) ? 1 : 0;
            }
            this._disableWalking(token);
        }
        catch(e) {
            console.log(`Unexpected Error in patrol: Was a token deleted during movement?:\n${e}`)
        }
    }

    async _navigationCycle(cycle, token)
    {
        let patrolData = this.tokenMap[token.id];
        let patrolPoints = (patrolData.isLinear)? patrolData.countinousRoutes: patrolData.plots; 
        let forceReturn;
        const settings = { // Reduces magic numbers.
            INCREMENT : 1, 
            DECREMENT : -1,
            PLOT_SIZE : patrolPoints.length,
            RETURN_SIZE : [].length,
            ON_INVERSE_FALSE: false,
            ON_INVERSE_TRUE: true,
            OPERATOR_GREATER : function(a, b) {return a >= b},
            OPERATOR_LESS : function(a, b) {return a < b},
        }
            
            let lastPos = await this._determineLastPosition(cycle, patrolPoints, token);
            forceReturn = await this._navigationLoop(patrolPoints, lastPos, settings.PLOT_SIZE, settings.OPERATOR_LESS, settings.ON_INVERSE_FALSE, settings.INCREMENT, token);
            if(forceReturn)
                return;
            lastPos = await this._determineLastPosition(cycle, patrolPoints, token);
            // The -1 indicates that we don't need to revist the last plot, given that we're already there.
            forceReturn = await this._navigationLoop(patrolPoints, lastPos - 1, settings.RETURN_SIZE, settings.OPERATOR_GREATER, settings.ON_INVERSE_TRUE, settings.DECREMENT, token); 
            if(forceReturn)
                return;


    }

    async _navigationLoop(patrolPoints, iterator, comparison, operation, onReturn, increment, token){
        let patrolData = this.tokenMap[token.id];
        if(!patrolData)
            return;
        const sleep = m => new Promise(r => setTimeout(r, m));
        if(patrolData.onInverseReturn == onReturn){
            for(iterator; operation(iterator, comparison); iterator = iterator + (increment)){
                await sleep(patrolData.delayPeriod[Math.floor(Math.random() * patrolData.delayPeriod.length)]); // Randomly selects a value within the delay period.
                if(!this.tokenMap[token.id])
                    return
                
                if(patrolData.isWalking && !game.paused && !this._wasTokenMoved(token) && this._validatePatrol(token) && !patrolData.isDeleted){
                    await this._navigateToNextPoint(patrolPoints[iterator], token);
                    this._storeLastPlotTaken(iterator, token);
                    if(false){ // Future update, maybe
                        await this.sayMessage(token);
                    }    
                }
                else{
                    if(game.paused == true){
                        iterator = iterator - increment;
                    }
                    else{
                        return true;
                    }
                }
                
            }
            if(patrolData.onInverseReturn || patrolData.inverted){
                this._setInverseReturn(token);
            }   
        }
    }

    async _determineLastPosition(cycle, plots, token){
        let patrolData = this.tokenMap[token.id];
        let lastPos = patrolData.lastPos;
        if(!patrolData.isInverted){
            if(cycle != 0 && lastPos == plots.length - 1){
                return 0;
            }
            return lastPos;
        }
        else{
            return lastPos;
        }
    }

    async _navigateToNextPoint(plot, token){
        try{
            await token.update(plot);
            this._updatelastRecordedLocation(plot, token);
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error in token navigation\n${error}`);
        }
    } 

    async _handleDelayPeriod(delay, tokenId){
        const MILLISECONDS = 1000;
        const DEFAULT_SECONDS = 2;
        const INVALID_NUMBER = 0;
        if(delay == null)
        {
            return
        }
        else{
            if(delay.match(/[^0-9&^\-&^\[&^\]&^\,&^\s]/g))
                return;

            delay = this._processDelayRegex(delay);
        }
        try{
            for(let i = 0; i < delay.length; ++i)
            {
                if(delay[i] <= INVALID_NUMBER)
                    delay[i] = (delay[i] * -1) + DEFAULT_SECONDS;
                delay[i] = delay[i] * MILLISECONDS;
            }
            this.tokenMap[tokenId].delayPeriod = delay;
        }
        catch(error) { // Occurs in the event the user fails to properly pass values. Simply returning will use the previously stored delayPeriod.
            return;
        }
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    /**
     * Parses the string to generate a valid array of ints.
     * Excess commas are ignored
     * Acceptable: [1-5] --> 1,2,3,4,5
     * Acceptable: 1,2,3,4,5 --> 1,2,3,4,5
     * Acceptable: [1-5],6,7 --> 1,2,3,4,5,6,7            
     * @param {string} delay 
     */
    _processDelayRegex(delay){
        delay = delay.replace(/ /g,""); // Remove Space
        let singleValue = delay.match(/[0-9]+/g);
        delay += ","; // This is a cheap work around for the regex. Since lookbehinds don't work in most browsers.
        let commaSeperated = delay.match(/(\d+(?=,))/g); // Checks for values that are strictly digits followed by commas.
        let rangeDelay = delay.match(/(\d+\-\d+)/g)
        delay = [];
        if(singleValue.length == 1){ // In the case there is only one value.
            delay.push(parseInt(singleValue[0]));
            return delay;
        }
        if(rangeDelay){ // In the case there is a [x1-x2] range.
            rangeDelay.forEach(function(rangeSet){
                let rangeValues = rangeSet.split('-');
                for(let i = parseInt(rangeValues[0]); i <= parseInt(rangeValues[1]); i++){
                    delay[delay.length] = i;
                }
            });
        };

        if(commaSeperated){ // In the case there is a x1,x2,.....,xn csv.
            commaSeperated.forEach(function(csvValue){
                delay[delay.length] = parseInt(csvValue);
            });     
        }        
        if(this.debug) console.log(`Foundry-Patrol: Wait periods include: ${delay}`);
        return delay;
    }

    linearWalk(generateEnd, tokenId){
        let plot = JSON.parse(JSON.stringify(this._getPlotsFromId(tokenId)));
        let len = plot.length - 1;
        if (generateEnd)
        {
            const ROUTE_START = 0
            let xMod = (plot[ROUTE_START].x >= plot[len].x) ? 1 : -1;
            let yMod = (plot[ROUTE_START].y >= plot[len].y) ? 1 : -1; 
            this._getGeneral(tokenId, 'endCountinousRoutes').length = 0;
            this._generateLinearRoute(this._getGeneral(tokenId, 'endCountinousRoutes'), plot[len], plot[ROUTE_START], xMod, yMod);          
        }

        else if(plot.length < 2){
            this._getGeneral(tokenId, 'countinousRoutes').push(plot[0]);
            game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
        }

        else{
            let xMod = (plot[len].x >= plot[len-1].x) ? 1 : -1;
            let yMod = (plot[len].y >= plot[len-1].y) ? 1 : -1; 
            this._generateLinearRoute(this._getGeneral(tokenId, 'countinousRoutes'), plot[len-1], plot[len], xMod, yMod);
        }
    }

    _generateLinearRoute(route, src, dest, xMod, yMod){
        const GRID_SIZE = canvas.grid.size;
        if(src.x == dest.x && src.y == dest.y)
        {
            game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
            return true;
        }
        else if(src.x != dest.x && src.y != dest.y)
        {
            src.x += GRID_SIZE * xMod;
            src.y += GRID_SIZE * yMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else if(src.x == dest.x && src.y != dest.y)
        {
            src.y += GRID_SIZE * yMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else if(src.x != dest.x && src.y == dest.y){
            src.x += GRID_SIZE * xMod;
            route.push({x: src.x, y: src.y});
            return this._generateLinearRoute(route, src, dest, xMod, yMod);
        }
        else{
            if(this.debug) console.log("Foundry-Patrol: Error in generating Continuous route.");
        }
    }

    updateTokenRoute(tokenId, updateData){
        if(this.tokenMap[tokenId]){
            this.tokenMap[tokenId]['plots'].push(updateData);
        }
        else{
            let generatedColor = this._generateColor();
            this.tokenMap[tokenId] = {};
            this.tokenMap[tokenId] = {
                color: generatedColor,
                plots: [],
                countinousRoutes : [],
                endCountinousRoutes : [],
                enabled: false,
                lastPos: 0,
                onInverseReturn: false,
                drawnPlots: [],
                isWalking: false,
                inverted: false,
                isLinear: false,
                lastRecordedLocation: {},
                delayPeriod: [2000],
                isDeleted: false,
                patrolMessages: []
            };
            this.tokenMap[tokenId]['plots'].push(updateData);
        }
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap)
    }

    generateTokenSchema(tokenId){
        let generatedColor = this._generateColor();
        this.tokenMap[tokenId] = {};
        this.tokenMap[tokenId] = {
            color: generatedColor,
            plots: [],
            countinousRoutes : [],
            endCountinousRoutes : [],
            enabled: false,
            lastPos: 0,
            onInverseReturn: false,
            drawnPlots: [],
            isWalking: false,
            inverted: false,
            isLinear: false,
            lastRecordedLocation: {},
            delayPeriod: [2000],
            isDeleted: false,
            patrolMessages: []
        };
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap)
    }

    removeTokenRoute(tokenId, removeAll=false){
        if(!this.tokenMap[tokenId])
            return;
        if(removeAll){
            delete this.tokenMap[tokenId];
        }
        else{
            let len = this.tokenMap[tokenId]['plots'].length;
            let p1 = this.tokenMap[tokenId]['plots'][len - 1]
            let p2 = this.tokenMap[tokenId]['plots'][len - 2]
            this.tokenMap[tokenId]['plots'].pop();
            this.tokenMap[tokenId].lastPos = 0;
            this.tokenMap[tokenId]['countinousRoutes'].length -= this._adjustLength(p1, p2);
            //this.linearWalk(true);
        }
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap)
        this.livePlotUpdate(tokenId);
    }

    _adjustLength(p1, p2){
        return Math.floor(Math.sqrt(Math.pow((p2.x - p1.x),2)+Math.pow((p2.y - p1.y),2))/canvas.grid.size);
    }

    removeAllTokenRoutes(){
        game.settings.set('foundry-patrol', 'tokenRoutes', {})
        this.livePlotUpdate(null);
    }

    _generateColor(){
        const HEX_LENGTH = 6;
        let options = "0123456789ABCDEF"
        let color = "0x";

        for(let i = 0; i < HEX_LENGTH; ++i){
            color += options[Math.floor(Math.random()* options.length)]
        }
        return color;
    } 

    deleteProcess(tokenId){
        let deletePrompt = new Dialog({
            title: "Patrol Delete",
            buttons: {
             one: {
              icon: '<i class="fas fa-check"></i>',
              label: "Confirm: Yes, delete all",
              callback: () => this.removeTokenRoute(tokenId, true)
             }, 
             two: {
                icon: '<i class="fas fa-undo"></i>',
                label: "Undo: Yes, but undo last",
                callback: () => this.removeTokenRoute(tokenId, false)
             },
             three: {
                icon: '<i class="fas fa-times"></i>',
                label: "Reject: I do not want to delete",
                callback: () => console.log("Foundry-Patrol: Mind changed, nothing deleted")
             },
            },
            default: "Ack",
            close: () => console.log("Foundry-Patrol: Prompt Closed")
        });
        deletePrompt.render(true);
    }

    deleteToken(tokenId, sceneId){
        if(!this.tokenMap[tokenId])
            return;
        delete this.tokenMap[tokenId]
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap)
    }

    livePlotUpdate(tokenId){
        if(!this.tokenMap[tokenId])
            return;
        this._removePlotDrawing(tokenId);
        canvas.layers[this.GLOBAL_ROUTES_INDEX].deactivate();
        this._displayPlot(tokenId, this.tokenMap[tokenId].inverted);
        canvas.layers[this.GLOBAL_ROUTES_INDEX].draw();
    }

    _removePlotDrawing(tokenId){ 
        let flags = canvas.scene.data.flags;
        let plotIndex = flags.routes.findIndex(function(element){
            return element.tokenId == tokenId;
        })
        if(plotIndex != -1){
            flags.routes.splice(plotIndex, 1);
            canvas.scene.update({flags: flags});
        }
    }

    async _displayPlot(tokenId, forwardsBackwards){
        let flags = canvas.scene.data.flags;
        let plots = this._getPlotsFromId(tokenId);
        if(!flags || !plots)
            return;

        if(plots.length > 0){
            let tokenColor = null;//this._getGeneral(tokenId, 'color');
            let drawnPlot = new drawRoute({
                points: plots, 
                dash: 25,
                gap: 25,
                offset: 750,
                color : this._getGeneral(tokenId, 'color'),
                fb : forwardsBackwards,
                tokenId : tokenId
            });
            flags.routes.push(drawnPlot);
            canvas.scene.update({flags: flags});
        }
    }

    _getPlotsFromId(tokenId){
        return getProperty(this.tokenMap, tokenId + ".plots");
    }
    
    _getDrawnPlot(tokenId){
        return getProperty(this.tokenMap, tokenId + ".drawnPlots") || false;
    }

    _getGeneral(tokenId, desiredProperty){
        return getProperty(this.tokenMap, tokenId + '.' + desiredProperty);
    }

    _validatePatrol(token){
        let patrolPoints = this._getPlotsFromId(token.id);
        if(!patrolPoints || patrolPoints.length <= 1){
            return false;
        }
        return true;
    }

    _storeLastPlotTaken(plotNumber, token){
        this.tokenMap[token.id].lastPos = plotNumber;
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    _updatelastRecordedLocation(futurePlot, token){
        let lastRecordedLocation = this.tokenMap[token.id].lastRecordedLocation;
        if(futurePlot != undefined){
            lastRecordedLocation.x = futurePlot.x;
            lastRecordedLocation.y = futurePlot.y;
        }
        else{
            lastRecordedLocation.x = getProperty(token.data, "x");
            lastRecordedLocation.y = getProperty(token.data, "y");
        }
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    _wasTokenMoved(token){
        try{
            if(this.tokenMap[token.id].lastRecordedLocation.x != getProperty(token.data, "x") || this.tokenMap[token.id].lastRecordedLocation.y != getProperty(token.data, "y")){
                this.tokenMap[token.id].isWalking = false;
                return true;
            }
            return false;
        }
        catch(error){
            if(this.debug) console.log(`Foundry-patrol: Error in validating patrol status -> \n ${error}`);
            return true;
        }
        
    }

    _setLinear(tokenId){
        this.tokenMap[tokenId].isLinear = !this.tokenMap[tokenId].isLinear;
        this.tokenMap[tokenId].lastPos = 0;
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    _setInverse(tokenId){
        this.tokenMap[tokenId].inverted = !this.tokenMap[tokenId].inverted;
        this.tokenMap[tokenId].lastPos = 0;
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
        this.livePlotUpdate(tokenId);
    }

    _setInverseReturn(token){
        this.tokenMap[token.id].onInverseReturn = !this.tokenMap[token.id].onInverseReturn;
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    _disableWalking(token){
        this.tokenMap[token.id].isWalking = false;
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap);
    }

    getDelayPeriod(tokenId){
        let patrolData = this.tokenMap[tokenId];
        let userDisplayDelay = []; // a more visually friendly format.
        for(let i = 0; i < patrolData.delayPeriod.length; ++i){
            userDisplayDelay.push(patrolData.delayPeriod[i]/1000);
        }
        return userDisplayDelay;
    }

    async sayMessage(token){
        const sleep = m => new Promise(r => setTimeout(r, m));
        if(false)
            return;
        await sleep(500);
        let randomMessage = this.tokenMap[token.id].patrolMessages[Math.floor(Math.random()*this.tokenMap[token.id].patrolMessages.length)];
        let delay = this._getDuration(randomMessage) + 500;
        await canvas.hud.bubbles.say(token, randomMessage);
        await sleep(delay);
    }

    //Line 17884 Foundry.js
    _getDuration(message) {
        let words = message.split(" ").map(w => w.trim()).length;
        let ms = (words * 60 * 1000) / 300;
        return Math.clamped(1000, ms, 20000);
      }

    addPatrolMessage(tokenId, message){
        if(!this.tokenMap[tokenId])
            TP.tokenPatroller.generateTokenSchema(tokenId);

        this.tokenMap[tokenId].patrolMessages.push(message);
        game.settings.set('foundry-patrol', 'tokenRoutes', this.tokenMap)
    }

}

class TokenHud{
    constructor(){}

    static HUD(token, html, data){
        let tokenId = getProperty(token, "data._id");
        let tokenMap = game.settings.get('foundry-patrol', 'tokenRoutes');
        let patrolData = getProperty(tokenMap, tokenId);
        let isPatrolling = false;
        let isLinear =  false;
        let isInverted = false;
        let delayPeriod = 2;
        if(patrolData){
            isPatrolling = patrolData.isWalking;
            isLinear = patrolData.linearMode;
            isInverted = patrolData.inverted;
            delayPeriod = TP.tokenPatroller.getDelayPeriod(tokenId);
        }


        const plotDiv = $(`
            <div class="plotDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 75px;">\
            </div>
        `);

        const addPlotPoint = $(`
            <div class="control-icon" style="margin-left: 4px;"> \ 
                <img src="modules/foundry-patrol/imgs/svg/map.svg" width="36" height="36" title="Add Point"> \
            </div>
        `);

        const deletePlotPoint = $(`<i class="control-icon fas fa-trash-alt" style="margin-left: 4px;" title="Delete Point"></i>`);

        let plotDirection = $(`<i class="control-icon fas fa-recycle" style="margin-left: 4px;" title="Cycle Mode"></i>`);

        if(isInverted){
            plotDirection = $(`<i class="control-icon fas fa-arrows-alt-h" style="margin-left: 4px;" title="Forwards-Backwards Mode"></i>`);
        }

        const patrolDiv = $(`
            <div class="patrolDiv" style="display: flex; flex-direction: row; justify-content: center; align-items:center; margin-right: 75px;">\
            </div>
        `);
        
        let linearWalkHUD = $(`
            <div class="control-icon" style="margin-left: 4px;"> \ 
                <img id="linearHUD" src="modules/foundry-patrol/imgs/svg/line.svg" width="36" height="36" title="Linear Walk"> \
            </div>
        `);

        if(isLinear){
            linearWalkHUD = $(`
                <div class="lineWalk control-icon" style="margin-left: 4px;"> \ 
                    <img id="linearHUD" src="modules/foundry-patrol/imgs/svg/linear.svg" width="36" height="36" title="Plot Walk"> \
                </div>
            `);
        }

        let patrolWalkHUD = $(`<i class="fas fa-walking title control-icon" style="margin-left: 4px;" title="Start route"></i>`);

        if(isPatrolling){
            patrolWalkHUD = $(`<i class="fas fa-times title control-icon" style="margin-left: 4px;" title="Stop route"></i>`)
        }
        // value = 
        const patrolDelayHUD = $(`<input class="control-icon"  style="margin-left: 4px;" type="text" id="patrolWait" value=${delayPeriod} name="patrolWait" title="Delay period">`)

        if(game.user.isGM || game.settings.get("foundry-patrol", "enablePlayerPatrol"))
        {
            html.find('.left').append(plotDiv);
            html.find('.plotDiv').append(addPlotPoint);
            html.find('.plotDiv').append(deletePlotPoint);
            html.find('.plotDiv').append(plotDirection);
            html.find('.left').append(patrolDiv);
            html.find('.patrolDiv').append(linearWalkHUD);
            html.find('.patrolDiv').append(patrolWalkHUD);
            html.find('.patrolDiv').append(patrolDelayHUD);

            addPlotPoint.click(ev => {
                TP.tokenPatroller.addPlotPoint(tokenId, token);
            });

            deletePlotPoint.click(ev => {
                TP.tokenPatroller.deleteProcess(tokenId);
            });

            linearWalkHUD.click(ev => {
                let src = ev.target.getAttribute('src')
                if(src == "modules/foundry-patrol/imgs/svg/linear.svg"){
                    ev.target.setAttribute('src', "modules/foundry-patrol/imgs/svg/line.svg")
                }else{
                    ev.target.setAttribute('src', "modules/foundry-patrol/imgs/svg/linear.svg")
                }
                if(patrolData)
                    TP.tokenPatroller._setLinear(tokenId);
            })

            plotDirection.click(ev => {
                let className = ev.target.getAttribute("class");
                if(className == "control-icon fas fa-arrows-alt-h"){
                    ev.target.className = "control-icon fas fa-recycle"

                }else{
                    ev.target.className = "control-icon fas fa-arrows-alt-h"
                } 
                if(patrolData)
                    TP.tokenPatroller._setInverse(tokenId);
            })

            

            patrolWalkHUD.click(ev => {
                let className = ev.target.getAttribute("class");
                if(className == "fas fa-walking title control-icon"){
                    ev.target.className = "fas fa-times title control-icon"
                }else{
                    ev.target.className = "fas fa-walking title control-icon"
                }
                let delayPeriod = document.getElementById("patrolWait").value;
                if(patrolData)
                    TP.tokenPatroller.startPatrol(delayPeriod, tokenId);
            });
        }
    }
}

/**
 * Basically taken from Foundry.js
 */
class RoutesLayer extends CanvasLayer
{
    constructor()
    {
        super();
        this.objects = null;
    }

    static get layerOptions() 
    {
        return {
            canDragCreate: true,
            snapToGrid: true
        }
    }

    /**
     * Similar to below, error occurs in the event the GM swaps scenes while the token is displaying. Since this.sceneId is unavailable
     * an error is thrown. Since this is the only known occurance of an error (by this module atleast), the error can be safely disregarded.
     */
    async draw()
    {
        try{
            await super.draw();
            this.objects = this.addChild(new PIXI.Container());
        
            let objectData = canvas.scene.data.flags.routes;
            for ( let data of objectData ) {
              let obj = await this.drawObject(data);
              this.objects.addChild(obj.drawing);
            }
        }
        catch(error){}
    }

    activate(){
        super.activate();
    }

    deactivate(){
        super.deactivate();
    }

    async drawObject(data){
        let obj = new drawRoute(data);
        return obj.showRoute();
    }
}

/**
 * Custom drawing used to display the lines that make up the patrol route.
 */
class drawRoute extends PlaceableObject{
    /**
     * Data is passed through as json from the corresponding token.
     */
    constructor(data)
    {
        super();
        this.fb = data.fb;
        this.points = JSON.parse(JSON.stringify(data.points)); 
        this.dash = data.dash;
        this.gap = data.gap;
        this.offset = data.offset;
        this.color = data.color;
        this.drawing = new PIXI.Graphics();
        this.tokenId = data.tokenId;
    }

    /**
     * Used to created the dashed lines between differing plot points.
     * 
     * Heavily inspired by ErikSom located here https://github.com/pixijs/pixi.js/issues/1333
     * A man much smarter than I.
     * @param {int} offset used for distance between lines.
     */
    _drawDashedLine(offset){ //Method inspired by user: 
        var dashSize = 0;
        var gapLength = 0;
        const GRID_SIZE = (canvas.grid.size == null)? 50 : canvas.grid.size/2;
        var pointOne, pointTwo;
        if(offset > 0){
            let progressiveOffset = (this.dash+this.gap)*offset
            if(progressiveOffset < this.dash)
            dashSize = this.dash - progressiveOffset;
            else
            gapLength = this.gap - (progressiveOffset - this.dash);
        }
    
        for(let i = this.points.length - 1; i >= 0; --i){
            pointOne = this.points[i];
            if(i == 0)
            {
                if(this.fb)
                    pointTwo = this.points[i];  
                else
                    pointTwo = this.points[this.points.length - 1]; // Forwards - backwards
            }
            else
                pointTwo = this.points[i-1];
            let dX = (pointTwo.x + GRID_SIZE) - (pointOne.x + GRID_SIZE); 
            let dY = (pointTwo.y + GRID_SIZE) - (pointOne.y + GRID_SIZE);
            let pointLen = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2))
            let seperatePoints = {x : dX/pointLen, y : dY/pointLen}
            let lineStart = 0;
            this.drawing.moveTo(pointOne.x + GRID_SIZE +gapLength*seperatePoints.x, pointOne.y + GRID_SIZE +gapLength*seperatePoints.y)
            while(lineStart <= pointLen){
                lineStart += gapLength;
                if(dashSize > 0)
                    lineStart += dashSize;
                else
                    lineStart += this.dash;
                
                if(lineStart > pointLen){
                    dashSize = lineStart - pointLen;
                    lineStart = pointLen;
                }
                else{
                    dashSize = 0;
                }
                this.drawing.lineTo(pointOne.x + GRID_SIZE + lineStart*seperatePoints.x, pointOne.y + GRID_SIZE +lineStart*seperatePoints.y)
                lineStart += this.gap;
                if(lineStart > pointLen && dashSize == 0){
                    gapLength = lineStart-pointLen;
                }
                else{
                    gapLength = 0;
                    this.drawing.moveTo(pointOne.x + GRID_SIZE + lineStart*seperatePoints.x, pointOne.y + GRID_SIZE +lineStart*seperatePoints.y)
                }
            }     
        }
    }

    /**
     * Responsible for the animation loop
     * An error will be thrown when the token is deselected, but this is intended and has no effect on
     * anything. The error is simply tossed.
     */
    showRoute(){
        try{ 
            this.drawing.clear();
            this.drawing.lineStyle(5, this.color, 0.7); // Magic numbers: refer to lineStyle by PIXI for details.
            var offsetInterval = this.offset;
            this._drawDashedLine((Date.now()%offsetInterval+1)/offsetInterval);
            requestAnimationFrame(this.showRoute.bind(this));
            return this;
        }
        catch(err){}
    }
}

/**
 * Logs the keys by the GM.
 * This is used for workflow increase
 */

class RoutesKeyLogger{
    constructor(){
        this.maps = {};
        
        // List of the valid keys to be mapped.
        this.keys = {
            'shift' : 16,
            'c'     : 67,
            'r'     : 82,
            'g'     : 71,
            'h'     : 72,
            'q'     : 81,
            't'     : 84,
            'one'   : 49
        }
    }

    /**
     * Gets key up and key down, then runs the requested function if the proper key is down.
     * Key One, is used for if the goal is only a single token.
     */
    getKeys = onkeyup = onkeydown = function(e){
        this.maps[e.keyCode] = e.type == 'keydown';
        if(this.maps[this.keys.shift] && this.maps[this.keys.q] && game.user.isGM)
        {
            if(this.maps[this.keys.r])
                this._addPlotSelectedToken();
            else if(this.maps[this.keys.h])
                this._haltAllRoutes(this.maps[this.keys.one]);
            else if(this.maps[this.keys.g])
                this._startAllRoutes(this.maps[this.keys.one]);
            else if(this.maps[this.keys.c])
                this._clearAllRoutes(this.maps[this.keys.one]);
            else if(this.maps[this.keys.t])
                this._resetAllColors(canvas.tokens.controlledTokens.length > 1);
        }
    }.bind(this);


    /**
     * Provides interface into token for adding a plot.
     */
    _addPlotSelectedToken(){
        for(let i = 0; i < canvas.tokens.controlledTokens.length; ++i)
        {
            let token = canvas.tokens.controlledTokens[i];
            TP.tokenPatroller.addPlotPoint(token.id, token);
        }
    }

    /**
     *  The following _functions all run the same general loop, in order to reduce code redundancy.
     *  Takes selectedToggle (which means only one token will be affected on true), and runs the general loop with the
     *  requested token Patrols function interface.
     */

    _haltAllRoutes(selectedToggle)
    {
        let tokens = (canvas.tokens.controlledTokens.length > 0 && selectedToggle) ? canvas.tokens.controlledTokens: canvas.tokens.ownedTokens;   
        for(let i = 0; i < tokens.length; ++i)
        {
            if(selectedToggle)
                TP.tokenPatroller._disableWalking(tokens[i]);
            else
                TP.tokenPatroller._disableWalking(tokens[i]);
        }
        ui.notifications.info("Routes halted for this scene");
    }  

    _startAllRoutes(selectedToggle)
    {
        let tokens = (canvas.tokens.controlledTokens.length > 0 && selectedToggle) ? canvas.tokens.controlledTokens: canvas.tokens.ownedTokens;   
        for(let i = 0; i < tokens.length; ++i)
        {
            if(selectedToggle)
                TP.tokenPatroller.startPatrol(undefined, tokens[i].id);
            else
                TP.tokenPatroller.startPatrol(undefined, tokens[i].id);
        }
        ui.notifications.info("Routes started for this scene");
    }

    _clearAllRoutes(selectedToggle){
        let tokens = (canvas.tokens.controlledTokens.length > 0 && selectedToggle) ? canvas.tokens.controlledTokens: canvas.tokens.ownedTokens;   
        for(let i = 0; i < tokens.length; ++i)
        {
            if(selectedToggle)
                TP.tokenPatroller.removeTokenRoute(tokens[i].id, true);
            else
                TP.tokenPatroller.removeTokenRoute(tokens[i].id, true);
        }
        ui.notifications.info("Routes cleared for this scene");
    }

    _resetAllColors(selectedToggle){
        this._generalLoop(Patrols.prototype._resetColor, selectedToggle);
        ui.notifications.info("Colors changed for this scene");
    }

}

Hooks.on('chatMessage', (chatLog, message, user) => {
    if(!user.speaker.token)
        return true;
    let messageModified = message.split(" ");
    if(messageModified[0] == "/pt"){
        TP.tokenPatroller.addPatrolMessage(getProperty(user, "speaker.token"), message.replace("/pt ", ""));
        return false;
    }
    return true;
})

TokenPatrollerInitalizer.initialize();




