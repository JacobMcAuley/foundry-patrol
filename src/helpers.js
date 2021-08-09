async function _patrolAnimateMovement(ray) {
    // Move distance is 10 spaces per second
    const s = canvas.dimensions.size;
    this._movement = ray;
    const speed = s * 10;
    let animSpeed;
    animSpeed = 2500;
    let isPathPatrolling = this.document.getFlag(TP.MODULENAME, "makePatroller");

    const duration = isPathPatrolling && !this._controlled ? animSpeed : (ray.distance * 1000) / speed;
  
    // Define attributes
    const attributes = [
      { parent: this, attribute: 'x', to: ray.B.x },
      { parent: this, attribute: 'y', to: ray.B.y }
    ];
  
    // Determine what type of updates should be animated
    const emits = this.emitsLight;
    const config = {
      animate: game.settings.get("core", "visionAnimation"),
      source: this._isVisionSource() || emits,
      sound: this._controlled || this.observer,
      fog: emits && !this._controlled && (canvas.sight.sources.size > 0)
    }
  
    // Dispatch the animation function
    let animationName = `Token.${this.id}.animateMovement`;
    await CanvasAnimation.animateLinear(attributes, {
      name: animationName,
      context: this,
      duration: duration,
      ontick: (dt, anim) => this._onMovementFrame(dt, anim, config)
    });
  
    // Once animation is complete perform a final refresh
    if ( !config.animate ) this._animatePerceptionFrame({source: config.source, sound: config.sound});
    this._movement = null;
  }
  
  