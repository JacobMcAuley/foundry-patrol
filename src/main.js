class Patrols{
    constructor(token, debug = true){
        this.debug = debug;
        if(this.debug) console.log("Foundry-Patrol: Creating");

        this.isWalking = false;
        this.sceneId = canvas.id;
        this.inverted = false;
        this.linearMode = false;
        this.token = token;
        this.patrolRoute = this.token.data.flags['foundry-patrol'].routes;
        this.lastRecordedLocation = {
            x : getProperty(this.token.data, "x"),
            y : getProperty(this.token.data, "y")
        }
        this.delayPeriod = [2000];
        this.isDeleted = false;

        this.drawnPlot = null;
        this.color = undefined;
        this.selected = false;
        this.initialize();
    }

    async initialize(){
        await this._doesSceneExist();
        this.color = this._setColor();
    }

    _setColor(){
        try{
            return this.token.data.flags['foundry-patrol'].routes[this.sceneId].color;
        }
        catch (error){
            return undefined;
        }
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

    _resetColor(){
        this.color = this._generateColor();
        this.token.data.flags['foundry-patrol'].routes[this.sceneId].color = this.color;
        this._updateToken();
        this.livePlotUpdate();
    }

    async addPlotPoint(displayInfo = false){
        await this.generateRoute({x: getProperty(this.token.data, "x"), y: getProperty(this.token.data, "y")});
        if(displayInfo) this._addPlotDisplay();
        this.livePlotUpdate();
        await this.linearWalk();
        await this.linearWalk(true); 
    }

    _addPlotDisplay(){
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
        pointAdded.render(true);
    }

    async generateRoute(plots){
        try{
            await this._addTokenPatrol(plots);
            this._updateToken();
        }catch(error){
            ui.notifications.error("Foundry-Patrol: Critical Error! Please hit F12 and JacobMcAuley a message on discord");
            console.log(`Foundry-Patrol: -> Generate Route: \n${error}`);
            return error;
        }
    }

    _doesSceneExist(){
        return new Promise(async (resolve, reject) => {
            try{
                if(this.patrolRoute[this.sceneId] == null){
                    this._generateScene();
                    resolve(false);
                }
                resolve(true);
            } 
            catch(error){
                reject(error);
            }

        })
    }

    _generateScene(){
        let color = this._generateColor();
        this.color = color;
        this.patrolRoute[this.sceneId] = {
            color: color,
            plots: [],
            countinousRoutes : [],
            endCountinousRoutes : [],
            enabled: false,
            lastPos: 0,
            onInverseReturn: false
        }
        return true;
    }

    _addTokenPatrol(plots){ 
        return new Promise((resolve, reject) => {
            try{
                this._updatePatrol();
                let plotPoints = this.patrolRoute[this.sceneId].plots;
                plotPoints.push({x: plots.x, y: plots.y});
                resolve(true);
            } 
            catch(error){
                reject(error);
            }
        })
    }

    _updateToken(){
        this.token.update(this.sceneId, JSON.parse(JSON.stringify(this.token.data))) // I couldn't think of how to do this and then I saw Felix' solution. Thanks!
    }

    async startPatrol(delay){
        await this._handleDelayPeriod(delay);
        this._updatelastRecordedLocation();
        this.isWalking = !this.isWalking;
        let cycle = 0;
        while(this.isWalking && this._validatePatrol())
        {
            await this._navigationCycle(cycle);
            cycle++;
        }
        this._disableWalking();
    }

    async _handleDelayPeriod(delay){
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
            this.delayPeriod = delay;
        }
        catch(error) { // Occurs in the event the user fails to properly pass values. Simply returning will use the previously stored delayPeriod.
            return;
        }
    }

    _processDelayRegex(delay){
        delay = delay.replace(/ /g,""); // Remove Space
        let singleValue = delay.match(/[0-9]+/g);
        delay += ","; // This is a cheap work around for the regex. Since lookbehinds don't work in most browsers.
        let commaSeperated = delay.match(/(\d+(?=,))/g); // Checks for values that are strictly digits followed by commas.
        let rangeDelay = delay.match(/(\d+\-\d+)/g)
        delay = [];
        if(singleValue.length == 1){
            delay.push(parseInt(singleValue[0]));
            return delay;
        }
        if(rangeDelay){
            rangeDelay.forEach(function(rangeSet){
                let rangeValues = rangeSet.split('-');
                for(let i = parseInt(rangeValues[0]); i <= parseInt(rangeValues[1]); i++){
                    delay[delay.length] = i;
                }
            });
        };

        if(commaSeperated){
            commaSeperated.forEach(function(csvValue){
                delay[delay.length] = parseInt(csvValue);
            });     
        }        
        if(this.debug) console.log(`Foundry-Patrol: Wait periods include: ${delay}`);
        return delay;
    }

    async _navigationCycle(cycle)
    {
        let patrolPoints = (this.isLinear)? this.getContinuousFromId: this.getPlotsFromId; //.concat(this.endCountinousRoutes); // [Fix plot.length -1] ---> [0]

        const settings = {
            INCREMENT : 1,
            DECREMENT : -1,
            PLOT_SIZE : patrolPoints.length,
            RETURN_SIZE : [].length,
            ON_INVERSE_FALSE: false,
            ON_INVERSE_TRUE: true,
            OPERATOR_GREATER : function(a, b) {return a >= b},
            OPERATOR_LESS : function(a, b) {return a < b},
        }

        try{
            let lastPos = await this._determineLastPosition(cycle, patrolPoints);
            await this._navigationLoop(patrolPoints, lastPos, settings.PLOT_SIZE, settings.OPERATOR_LESS, settings.ON_INVERSE_FALSE, settings.INCREMENT);
            lastPos = await this._determineLastPosition(cycle, patrolPoints);
            // The -1 indicates that we don't need to revist the last plot, given that we're already there.
            await this._navigationLoop(patrolPoints, lastPos - 1, settings.RETURN_SIZE, settings.OPERATOR_GREATER, settings.ON_INVERSE_TRUE, settings.DECREMENT); 
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error --> Token can not be referenced. Likely a massive delete ${error}`);
        }
    }

    async _navigationLoop(patrolPoints, iterator, comparison, operation, onReturn, increment){
        const sleep = m => new Promise(r => setTimeout(r, m));
        if(this.onInverseReturn == onReturn){
            for(iterator; operation(iterator, comparison); iterator = iterator + (increment)){
                await sleep(this.delayPeriod[Math.floor(Math.random() * this.delayPeriod.length)]);
                if(this.isWalking && !game.paused && !this._wasTokenMoved() && this._validatePatrol() && !this.isDeleted){
                    await this._navigateToNextPoint(patrolPoints[iterator]);
                    this._storeLastPlotTaken(iterator);
                }
                else{
                    if(game.paused == true){
                        iterator = iterator - increment;
                    }else{
                        this._disableWalking();
                        break;
                    }
                }
            }
            if(this.onInverseReturn || this.inverted){
                this._setInverseReturn();
            }   
        }
    }

    async _determineLastPosition(cycle, plots){
        let lastPos = this.patrolRoute[this.sceneId].lastPos;
        if(!this.isInverted){
            if(cycle != 0 && lastPos == plots.length - 1){
                return 0;
            }
            return lastPos;
        }
        else{
            return lastPos;
        }
    }

    async _navigateToNextPoint(plot){
        try{
            await this.token.update(this.sceneId, plot);
            this._updatelastRecordedLocation(plot);
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error in token navigation\n${error}`);
        }
    } 

    async linearWalk(generateEnd = false){
        let plot = await JSON.parse(JSON.stringify(this.getPlotsFromId));
        let len = plot.length - 1;

        if (generateEnd)
        {
            const ROUTE_START = 0
            let xMod = (plot[ROUTE_START].x >= plot[len].x) ? 1 : -1;
            let yMod = (plot[ROUTE_START].y >= plot[len].y) ? 1 : -1; 
            this.patrolRoute[this.sceneId].endCountinousRoutes.length = 0;
            await this._generateLinearRoute(this.patrolRoute[this.sceneId].endCountinousRoutes, plot[len], plot[ROUTE_START], xMod, yMod);          
        }


        else if(plot.length < 2){
            console.log(plot[0])
            this.patrolRoute[this.sceneId].countinousRoutes.push(plot[0]);
            this._updateToken();
        }

        else{
            let xMod = (plot[len].x >= plot[len-1].x) ? 1 : -1;
            let yMod = (plot[len].y >= plot[len-1].y) ? 1 : -1; 
            await this._generateLinearRoute(this.patrolRoute[this.sceneId].countinousRoutes, plot[len-1], plot[len], xMod, yMod);
        }
    }

    async _generateLinearRoute(route, src, dest, xMod, yMod){
        const GRID_SIZE = canvas.grid.size;
        if(src.x == dest.x && src.y == dest.y)
        {
            console.log(route);
            this._updateToken();
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


    _wasTokenMoved(){
        try{
            if(this.lastRecordedLocation.x != getProperty(this.token.data, "x") || this.lastRecordedLocation.y != getProperty(this.token.data, "y")){
                return true;
            }canvas
            return false;
        }
        catch(error){
            if(this.debug) console.log(`Foundry-patrol: Error in validating patrol status -> \n ${error}`);
            return true;
        }
        
    }

    _validatePatrol(){
        let patrolPoints = this.getPlotsFromId;
        if(!patrolPoints || patrolPoints.length == 0){
            if(this.debug) console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
        return true;
    }

    _storeLastPlotTaken(plotNumber){
        this.patrolRoute[this.sceneId].lastPos = plotNumber;
        this._updateToken();
    }

    _updatelastRecordedLocation(futurePlot){
        if(futurePlot != undefined){
            this.lastRecordedLocation.x = futurePlot.x;
            this.lastRecordedLocation.y = futurePlot.y;
        }
        else{
            this.lastRecordedLocation.x = getProperty(this.token.data, "x");
            this.lastRecordedLocation.y = getProperty(this.token.data, "y");
        }
    }


    deleteProcess(){
        let deletePrompt = new Dialog({
            title: "Patrol Delete",
            buttons: {
             one: {
              icon: '<i class="fas fa-check"></i>',
              label: "Confirm: Yes, delete all",
              callback: () => this._deleteRoutes()
             }, 
             two: {
                icon: '<i class="fas fa-undo"></i>',
                label: "Undo: Yes, but undo last",
                callback: () => this._undoLast()
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

    _deleteRoutes(){
        if(this.getPlotsFromId != false){
            this.isWalking == false;
            this._updatePatrol();
            this.patrolRoute[this.sceneId].plots.length = 0;
            this.patrolRoute[this.sceneId].countinousRoutes.length = 0;
            this.patrolRoute[this.sceneId].endCountinousRoutes.length = 0;
            this.patrolRoute[this.sceneId].lastPos = 0;
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    _undoLast(){ // Cont fix required
        if(this.getPlotsFromId != false){
            this._updatePatrol();
            this.patrolRoute[this.sceneId].plots.pop();
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    _setLinear(){
        this.linearMode = !this.linearMode;
        this.patrolRoute[this.sceneId].lastPos = 0;
    }

    _setInverse(){
        this.inverted = !this.inverted;
        this.patrolRoute[this.sceneId].lastPos = 0;
        this.livePlotUpdate(this.inverted);
    }

    _setInverseReturn(){
        this.patrolRoute[this.sceneId].onInverseReturn = !this.patrolRoute[this.sceneId].onInverseReturn;
        this._updateToken();
    }

    _disableWalking(){
        this.isWalking = false;
    }

    _updatePatrol(){
        this.patrolRoute = this.token.data.flags['foundry-patrol'].routes;
    }

    displayPlot(forwardsBackwards){
        let flags = canvas.scene.data.flags;
        if(this.getPlotsFromId.length > 0){
            this.drawnPlot = new drawRoute({
                points: this.getPlotsFromId, 
                dash: 25,
                gap: 25,
                offset: 750,
                color : this.color,
                fb : forwardsBackwards
            });
            flags.routes.push(this.drawnPlot);
            canvas.scene.update({flags: flags});
        }
    }

    removePlot(){
        let flags = canvas.scene.data.flags;
        let tempPlot = this.drawnPlot
        let plotIndex = flags.routes.findIndex(function(element){
            return element == tempPlot;
        })
        if(plotIndex != -1){
            flags.routes.splice(plotIndex, 1);
            canvas.scene.update({flags: flags});
        }
    }

    livePlotUpdate(){
        this.removePlot();
        canvas.layers[GLOBAL_ROUTES_INDEX].deactivate();
        this.displayPlot(this.isInverted);
        canvas.layers[GLOBAL_ROUTES_INDEX].draw();
    }

    get getPlotsFromId(){
        try{
            return this.patrolRoute[this.sceneId].plots; 
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: ERROR -> ${error}`);
            return false;
        }
    }

    get getContinuousFromId(){
        try{
            if(this.isInverted){
                return this.patrolRoute[this.sceneId].countinousRoutes;
            }
            return this.patrolRoute[this.sceneId].countinousRoutes.concat(this.patrolRoute[this.sceneId].endCountinousRoutes); 
        }
        catch{
            return [];
        }
    }

    get isInverted(){
        return this.inverted;
    }

    get onInverseReturn(){
        return this.patrolRoute[this.sceneId].onInverseReturn;
    }

    get isPatrolling(){
        return this.isWalking;
    }
    
    get getDelayPeriod(){
        let userDisplayDelay = []; // a more visually friendly format.
        for(let i = 0; i < this.delayPeriod.length; ++i){
            userDisplayDelay.push(this.delayPeriod[i]/1000);
        }
        return userDisplayDelay;
    }
   
    get lastPos(){
        return this.patrolRoute[this.sceneId].lastPos
    }

    get getAllRoutes(){
        return this.patrolRoute;
    }
    
    get isLinear(){
        return this.linearMode;
    }
}