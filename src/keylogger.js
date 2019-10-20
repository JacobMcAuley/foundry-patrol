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
            canvas.tokens.controlledTokens[i].routes.addPlotPoint();
        }
    }

    /**
     *  The following _functions all run the same general loop, in order to reduce code redundancy.
     *  Takes selectedToggle (which means only one token will be affected on true), and runs the general loop with the
     *  requested token Patrols function interface.
     */

    _haltAllRoutes(selectedToggle)
    {
        this._generalLoop(Patrols.prototype._disableWalking, selectedToggle);
        ui.notifications.info("Routes halted for this scene");
    }  

    _startAllRoutes(selectedToggle)
    {
        this._generalLoop(Patrols.prototype.startPatrol, selectedToggle);
        ui.notifications.info("Routes started for this scene");
    }

    _clearAllRoutes(selectedToggle){
        this._generalLoop(Patrols.prototype._deleteRoutes, selectedToggle);
        ui.notification
        s.info("Routes cleared for this scene");
    }

    _resetAllColors(selectedToggle){
        this._generalLoop(Patrols.prototype._resetColor, selectedToggle);
        ui.notifications.info("Colors changed for this scene");
    }

    /**
     * General loop for iterating over all controlled tokens running the desired method.
     * @param {function} method 
     * @param {boolean} selectedToggle 
     */
    _generalLoop(method, selectedToggle){
        let tokens = (canvas.tokens.controlledTokens.length > 0 && selectedToggle) ? canvas.tokens.controlledTokens: canvas.tokens.ownedTokens;   
        for(let i = 0; i < tokens.length; ++i)
        {
            if(selectedToggle)
                method.call(tokens[i].routes);
            else
                method.call(tokens[i].routes);
        }
    }
}