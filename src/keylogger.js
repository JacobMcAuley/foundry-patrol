class RoutesKeyLogger{
    constructor(){
        this.maps = {};
        this.flags = canvas.scene.data.flags;
    }

    getKeys = onkeyup = onkeydown = function(e){
        this.maps[e.keyCode] = e.type == 'keydown';
        if(this.maps[16] && this.maps[67]){
            this.addPlotSelectedToken();
        }
    }.bind(this);

    addPlotSelectedToken(){
        for(let i = 0; i < this.flags["selected"].length; ++i)
        {
            this.flags["selected"][i].addPlotPoint();
        }
    }
}
