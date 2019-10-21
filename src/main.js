class Patrols{
    constructor(token, debug = false){
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
        this._initialize();
    }

    /**
     *                       ---------------  INTERFACES ----------------
     */


    /**
     * Primary interface for adding a plot point to the data flag of the token.
     * @param {boolean} displayInfo HUD for confirming point placement. Mostly redundant, given that you can see it now.
     */
    async addPlotPoint(displayInfo = false){
        await this.generateRoute({x: getProperty(this.token.data, "x"), y: getProperty(this.token.data, "y")});
        if(displayInfo) this._addPlotDisplay();
        this.livePlotUpdate();
        await this.linearWalk();
        await this.linearWalk(true); // True simply means to create a continous point using the end node and the starting node.
    }

    /**
     * Add the plot point to the token's patrol and updates the token.
     * 
     * This method is considered an interface as you could directly call it; however, it is handled by addPlotPoint
     * @param {json} plots 
     */
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

    /**
     * Interface for handling the start of the patrol route. 
     * Call this function to begin the process of movement.
     * @param {int} delay 
     */
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

    /**
     * Interface responsible for drawing routes.
     */
    livePlotUpdate(){
        this._removePlotDrawing();
        canvas.layers[GLOBAL_ROUTES_INDEX].deactivate();
        this._displayPlot(this.isInverted);
        canvas.layers[GLOBAL_ROUTES_INDEX].draw();
    }

    /**
     * Prompt used for deleting or undoing routes.
     */
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

    /**
     *                       ---------------  Helper Functions ----------------
     */

    /**
     * Makes sure the necessary data flags exists
     * Creates color if not already set.
     * @private
     */
    async _initialize(){
        await this._doesSceneExist();
        this.color = this._setColor();
    }

    /**
     *  Sets the color to the data flag if it exists
     *  Otherwise return black (undefined)
     *  @private
     */
    _setColor(){
        try{
            return this.token.data.flags['foundry-patrol'].routes[this.sceneId].color;
        }
        catch (error){
            return undefined;
        }
    }

    /**
     * Responsible for color generation in hex.
     * @private
     */
    _generateColor(){
        const HEX_LENGTH = 6;
        let options = "0123456789ABCDEF"
        let color = "0x";

        for(let i = 0; i < HEX_LENGTH; ++i){
            color += options[Math.floor(Math.random()* options.length)]
        }
        return color;
    } 

    /**
     * Used as the interface for Keylogger to reset colors
     * @private
     */
    _resetColor(){
        this.color = this._generateColor();
        this.token.data.flags['foundry-patrol'].routes[this.sceneId].color = this.color;
        this._updateToken();
        this.livePlotUpdate();
    }

    /**
     * Redunant confirmation of plot display. Left in for future use
     * @private
     */
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

    /**
     * Checks to see if the patrol route data flag exists and creates it if it doesn't. Called by _initalize
     * @private
     */
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

    /**
     * Responsible for pushing the json into data.flags[foundry-patrol]
     */
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

    /**
     * Creates a promise to resolve adding the plot points to the token.
     * Resolves if the value is added.
     * @param {json -> {x: val, y: val}} plots 
     */
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

    /**
     * Update token is called frequently and pushes the values added to the token back to the server
     * This gives allows data in token.data.flags[foundry-patrol] to persist over sessions.
     */
    _updateToken(){
        //While I was still learning javascript I wasns't sure how to deep copy. Felix' solution pointed me in the right direction
        this.token.update(this.sceneId, JSON.parse(JSON.stringify(this.token.data)))
    }

    /**
     * Given the input of delay on the tokenHUD, handle the request.
     * Checks to see if the input is of a valid type. IE: No mismatched characters
     * Then passes it to this._processDelayRegex(delay)
     * 
     * Additionally, numbers less than 0 are converted into 2.
     * @param {string} delay 
     */
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

    /**
     * Primary function responsible for calling individiual navigation loops. 
     * Retrieves the proper set of points depending on the mode and runs a generic looping function as to not
     * repeat code. 
     * lastPos is used to recall the last position (assuming no mode changes occured) in the case of stopping.
     * @param {int} cycle 
     */
    async _navigationCycle(cycle)
    {
        let patrolPoints = (this.isLinear)? this.getContinuousFromId: this.getPlotsFromId; 

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

        try{
            let lastPos = await this._determineLastPosition(cycle, patrolPoints);
            await this._navigationLoop(patrolPoints, lastPos, settings.PLOT_SIZE, settings.OPERATOR_LESS, settings.ON_INVERSE_FALSE, settings.INCREMENT);
            lastPos = await this._determineLastPosition(cycle, patrolPoints);
            // The -1 indicates that we don't need to revist the last plot, given that we're already there.
            await this._navigationLoop(patrolPoints, lastPos - 1, settings.RETURN_SIZE, settings.OPERATOR_GREATER, settings.ON_INVERSE_TRUE, settings.DECREMENT); 
        }
        catch(error){ // This error seems to occur when too many tokens are deleted at once mid movement and it tries to access a value of a deleted token.
            if(this.debug) console.log(`Foundry-Patrol: Error --> Token can not be referenced. Likely a massive delete ${error}`);
        }
    }

    /**
     * Serves as a general purpose function for navigation looping.
     * Takes the below parameters and places them into a general loop. 
     * Mostly, this is used for forwardBackwards mode, in which a different iterator and comparator are required
     * IE: i = 0, i < n; i++ to i = n, i > 0, i--
     * @param { [{x: val, y: val}] } patrolPoints 
     * @param {int} iterator 
     * @param {int} comparison 
     * @param {function} operation 
     * @param {boolean} onReturn 
     * @param {int} increment 
     */
    async _navigationLoop(patrolPoints, iterator, comparison, operation, onReturn, increment){
        const sleep = m => new Promise(r => setTimeout(r, m));
        if(this.onInverseReturn == onReturn){
            for(iterator; operation(iterator, comparison); iterator = iterator + (increment)){
                await sleep(this.delayPeriod[Math.floor(Math.random() * this.delayPeriod.length)]); // Randomly selects a value within the delay period.
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

    /**
     * Determines the last position.
     * Note: cycle is used for this instance: Determines whether the patrol ended at the end, thus must be flipped
     * Otherwise, returns the normally recorded lastPos.
     * @param {int} cycle 
     * @param {[{x: val, y: val}]} plots 
     */
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

    /**
     * Moves the token to the passed position.
     * Then stores the last known location. (Used to stop movement if input is detected)
     * @param {{x: val, y: val}} plot 
     */
    async _navigateToNextPoint(plot){
        try{
            await this.token.update(this.sceneId, plot);
            this._updatelastRecordedLocation(plot);
        }
        catch(error){
            if(this.debug) console.log(`Foundry-Patrol: Error in token navigation\n${error}`);
        }
    } 

    /**
     * Interface for determining the direction of two points and running
     * the private method to generate the individual plots between two points.
     * @param {boolean} generateEnd 
     */
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

    /**
     * Recursively determines the individual points between two nodes.
     * Each point between two nodes is added to param: Route and then updated
     * once the function reaches the end node.
     * @param {[{x: val,y: val}]} route 
     * @param {{x: val,y: val}} src 
     * @param {{x: val,y: val}} dest 
     * @param {int} xMod 
     * @param {int} yMod 
     */
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

    /**
     * Used to determine if the last plot point of the token is the same as the current position of the token
     * If not, the token can be said to be moved and the token patrol will stop.
     */
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

    /**
     * ValidatePatrol is used to prevent <= 1 plot from starting a walking cycle
     * Mostly reduces time on running unnecessary code.
     */
    _validatePatrol(){
        let patrolPoints = this.getPlotsFromId;
        if(!patrolPoints || patrolPoints.length <= 1){
            if(this.debug) console.log("Foundry-Patrol: Patrol Points not set.");
            return false;
        }
        return true;
    }

    /**
     * Stores and updates the last known plot location (an index in an array)
     * @param {int} plotNumber 
     */
    _storeLastPlotTaken(plotNumber){
        this.patrolRoute[this.sceneId].lastPos = plotNumber;
        this._updateToken();
    }

    /**
     * Self explanatory. Stores the last point
     * Used to determine if the token has moved during patrol runtime, canceling if true.
     * @param {{x:val, y:val}} futurePlot 
     */
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


    /**
     * Responsible for deleting routes.
     * Resets all values back to 0 and updates.
     */
    _deleteRoutes(){
        if(this.getPlotsFromId != false){ // Checks to see if the value exists
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

    /**
     * Undoes the last point, adjusting the linearWalk and plotpoints as it does it
     */
    _undoLast(){ 
        if(this.getPlotsFromId != false){
            this._updatePatrol();
            let len = this.patrolRoute[this.sceneId].plots.length;
            let p1 = this.patrolRoute[this.sceneId].plots[len - 1]
            let p2 = this.patrolRoute[this.sceneId].plots[len - 2]
            this.patrolRoute[this.sceneId].plots.pop();
            this.patrolRoute[this.sceneId].lastPos = 0;
            this.patrolRoute[this.sceneId].countinousRoutes.length -= this._adjustLength(p1, p2);
            this.linearWalk(true);
            this._updateToken();
            this.livePlotUpdate();
        }
    }

    /**
     * Called by _undoLast to generate the distance between the undone points.
     * @param {{x:val, y:val}} p1 
     * @param {{x:val, y:val}} p2 
     */
    _adjustLength(p1, p2){
        return Math.floor(Math.sqrt(Math.pow((p2.x - p1.x),2)+Math.pow((p2.y - p1.y),2))/canvas.grid.size);
    }

    /**
     * Switches between linear mode and node mode.
     */
    _setLinear(){
        this.linearMode = !this.linearMode;
        this.patrolRoute[this.sceneId].lastPos = 0;
    }

    /**
     * Switches between forwardbackwards mode and cycle mode.
     */
    _setInverse(){
        this.inverted = !this.inverted;
        this.patrolRoute[this.sceneId].lastPos = 0;
        this.livePlotUpdate(this.inverted);
    }

    /**
     * Sets the flag of on inverse return to not inverseReturn.
     */
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

    /**
     * Responsible for the data for the drawing in Routelayer.
     * @param {boolean} forwardsBackwards 
     */
    _displayPlot(forwardsBackwards){
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

    /**
     * Finds the drawing in the RoutesLayer index and removes it.
     */
    _removePlotDrawing(){ 
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

/**
 *                          ------------------ Getters ------------------
 * 
 *                      No definition necessary. Returns frequently indexed values.
 */

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