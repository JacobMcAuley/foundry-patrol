/**
 * Adds all the HUD interfaces
 */
class tokenHud{
    constructor(){}

    HUD(app, html, data){
        let token = app.object;
        let isPatrolling = token.routes.isPatrolling;
        let isLinear = token.routes.isLinear;
        let isInverted = token.routes.isInverted;

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

        const patrolDelayHUD = $(`<input class="control-icon"  style="margin-left: 4px;" type="text" id="patrolWait" value=${token.routes.getDelayPeriod} name="patrolWait" title="Delay period">`)

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
                token.routes.addPlotPoint();
            });

            deletePlotPoint.click(ev => {
                token.routes.deleteProcess();
            });

            linearWalkHUD.click(ev => {
                let src = ev.target.getAttribute('src')
                if(src == "modules/foundry-patrol/imgs/svg/linear.svg"){
                    ev.target.setAttribute('src', "modules/foundry-patrol/imgs/svg/line.svg")
                }else{
                    ev.target.setAttribute('src', "modules/foundry-patrol/imgs/svg/linear.svg")
                } 
                token.routes._setLinear();
            })

            plotDirection.click(ev => {
                let className = ev.target.getAttribute("class");
                if(className == "control-icon fas fa-arrows-alt-h"){
                    ev.target.className = "control-icon fas fa-recycle"

                }else{
                    ev.target.className = "control-icon fas fa-arrows-alt-h"
                } 
                token.routes._setInverse();
            })

            

            patrolWalkHUD.click(ev => {
                let className = ev.target.getAttribute("class");
                if(className == "fas fa-walking title control-icon"){
                    ev.target.className = "fas fa-times title control-icon"
                }else{
                    ev.target.className = "fas fa-walking title control-icon"
                }
                let delayPeriod = document.getElementById("patrolWait").value;
                token.routes.startPatrol(delayPeriod);
            });
        }
    }
}
