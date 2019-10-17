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
        try{
            await super.draw();
            this.objects = this.addChild(new PIXI.Container());
        
            let objectData = canvas.scene.data.flags.routes;
            for ( let data of objectData ) {
              let obj = await this.drawObject(data);
              this.objects.addChild(obj.drawing);
            }
        }
        catch(error){
            console.log("Foundry-Patrol: Routes layer draw has thrown an error. Likely the scene was swapped. This can be disregarded");
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
        this.fb = data.fb;
        this.points = JSON.parse(JSON.stringify(data.points)); // Deep copy
        this.dash = data.dash;
        this.gap = data.gap;
        this.offset = data.offset;
        this.color = data.color;
        this.drawing = new PIXI.Graphics();
    }

    _drawDashedLine(offset){ //Method inspired by user: ErikSom located here https://github.com/pixijs/pixi.js/issues/1333
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

    showRoute(){
        try{ // Error message will get thrown when drawing is removed, as the animation can no longer clear.
            this.drawing.clear();
            this.drawing.lineStyle(5, this.color, 0.7);
            var offsetInterval = this.offset;
            this._drawDashedLine((Date.now()%offsetInterval+1)/offsetInterval);
            requestAnimationFrame(this.showRoute.bind(this));
            return this;
        }
        catch(err){
            console.log("Foundry-Patrol: Route cleared");
        }
    }
}