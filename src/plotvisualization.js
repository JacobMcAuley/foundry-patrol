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