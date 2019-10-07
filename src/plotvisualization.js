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

    async draw()
    {
        await super.draw();
        // Create objects container
        this.objects = this.addChild(new PIXI.Container());
    
    
        // Create and draw placeable objects
        let objectData = canvas.scene.data.flags.routes;
        for ( let data of objectData ) {
          let obj = await this.drawObject(data);
          this.objects.addChild(obj.drawing);
        }
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

class drawRoute extends PlaceableObject{
    constructor(data) //points, dash, gap, offset)
    {
        super();
        this.points = JSON.parse(JSON.stringify(data.points)); // Deep copy
        this.dash = data.dash;
        this.gap = data.gap;
        this.offset = data.offset;
        this.drawing = new PIXI.Graphics();
        this.drawID = null;
    }

    _drawDashedLine(offset){ //Method inspired by user: ErikSom located here https://github.com/pixijs/pixi.js/issues/1333
        var dashSize = 0;
        var gapLength = 0;
        var GRIDSIZE = null // CHANGE ALL 50s to GRIDSIZE;
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
                pointTwo = this.points[this.points.length - 1]; // Forwards - backwards
            else
                pointTwo = this.points[i-1];
            let dX = (pointTwo.x + 50) - (pointOne.x + 50); 
            let dY = (pointTwo.y + 50) - (pointOne.y + 50);
            let pointLen = Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2))
            let seperatePoints = {x : dX/pointLen, y : dY/pointLen}
            let lineStart = 0;
            this.drawing.moveTo(pointOne.x + 50 +gapLength*seperatePoints.x, pointOne.y + 50 +gapLength*seperatePoints.y)
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
                this.drawing.lineTo(pointOne.x + 50 + lineStart*seperatePoints.x, pointOne.y + 50 +lineStart*seperatePoints.y)
                lineStart += this.gap;
                if(lineStart > pointLen && dashSize == 0){
                    gapLength = lineStart-pointLen;
                }
                else{
                    gapLength = 0;
                    this.drawing.moveTo(pointOne.x + 50 + lineStart*seperatePoints.x, pointOne.y + 50 +lineStart*seperatePoints.y)
                }
            }
            
        }
    }


    showRoute(){
        if(!this.drawID){
            console.log("RUNNING THE DRAWING");
            this.drawing.clear();
            this.drawing.lineStyle(5, 0x00FF00, 0.7);
            var offsetInterval = this.offset;
            this._drawDashedLine((Date.now()%offsetInterval+1)/offsetInterval);
            requestAnimationFrame(this.showRoute.bind(this));
            return this;
        }
    }

    deactivate(){
        this.drawing.clear();
        if(this.drawID){
            cancelAnimationFrame(this.drawID);
            this.drawID = undefined;
        }
    }

}

/*
let x = canvas.tokens.ownedTokens[0]
x.routes.displayPlot()
x.routes.drawnPlot.showRoute();

x.routes.drawnPlot.deactivate();
*/