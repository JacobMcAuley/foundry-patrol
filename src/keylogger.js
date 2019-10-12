class RoutesKeyLogger{
    constructor(){
        this.maps = {};
        this.keys = {
            'shift' : 16,
            'c'     : 67,
            'r'     : 82,
            'g'     : 71,
            'h'     : 72,
            'q'     : 81
        }
    }

    getKeys = onkeyup = onkeydown = function(e){
        this.maps[e.keyCode] = e.type == 'keydown';
        if(this.maps[this.keys.shift])
        {
            if(this.maps[this.keys.r]){
                this._addPlotSelectedToken();
            }
            else if(this.maps[this.keys.h])
            {
                this._haltAllRoutes(this.maps[this.keys.q]);
            }
            else if(this.maps[this.keys.g])
            {
                this._startAllRoutes(this.maps[this.keys.q]);
            }
            else if(this.maps[this.keys.c])
            {
                this._clearAllRoutes(this.maps[this.keys.q]);
            }
        }
    }.bind(this);

    _addPlotSelectedToken(){
        for(let i = 0; i < canvas.tokens.controlledTokens.length; ++i)
        {
            canvas.tokens.controlledTokens[i].routes.addPlotPoint();
        }
    }

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
        ui.notifications.info("Routes cleared for this scene");
    }

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