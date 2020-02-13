/**
 * This is a p5.js binding to preload(). It is called before setup to load resources
 * like images.
 */
function preload() {
  // GameManager is a class that contains the game state and high level game operations.
  // It is the only public scope variable in this project.
  GameManager.preload();
  gameManager = new GameManager();
}

/**
 * This is a p5.js binding to setup(). It is called before animating to setup graphics
 * options.
 */
function setup() {
  gameManager.setup();
}

/**
 * This is a p5.js binding to draw(). It is called every frame to draw the graphics.
 */
function draw() {
  // Tick does the calculations for where all the objects should be drawn and is called every
  // frame.
  gameManager.tick();

  // Draw draws all the objects to the screen in their new positions.
  gameManager.draw();
}

/**
 * This is a p5.js binding to keyTyped(). It is called when a key is typed (pressed and released.)
 */
function keyTyped() {
  gameManager.keyTyped({ key: key });
}

/**
 * This class manages the game at a high level. It handles all the p5.js bindings like preload(), setup(),
 * draw(), keyTyped() etc. It also manages calculating the position of the game objects and drawing them,
 * checking for collisions, etc.
 */
class GameManager {

  constructor() {
    this._descriptionText = GameManager._descriptionInitial;
    this._descriptionFontSize = GameManager._descriptionInitialFontSize;
  }

  /**
  * Setup the graphics options and create the game objects.
  */
  setup() {
    // Resize the canvas to occupy the entire screen in p5.js.
    createCanvas(windowWidth, windowHeight);
    // Set the framerate to 30 frames per second in p5.js
    frameRate(GameManager._frameRate);

    // Create the controllable person.
    this._person = new Person({
      position: MathHelper.VECTOR_ZERO()
    });

    // Create the fence.
    this._fence = new Fence({
      position: MathHelper.VECTOR_ZERO()
    });

    // Create 10 cows and randomly place them on the screen. This uses the random
    // function from p5.js (not the built-in JavaScript one.)
    this._cows = Array.from({ length: 3 }, () =>
      new Cow({
        // createVector is a p5.js function that creates a p5.Vector object.
        // width and height are p5.js variables that correspond the canvas size.
        position: createVector(
          random(-width / 2 + GameManager._edgeWidth, width / 2 - GameManager._edgeWidth),
          random(-height / 2 + GameManager._edgeWidth, height / 2 - GameManager._edgeWidth))
      })
    );

    // Create the title.
    this._title = new Sprite({
      image: GameManager._titleImage,
      size: GameManager._titleSize.copy(),
      position: GameManager._titlePosition.copy(),
      velocity: MathHelper.VECTOR_ZERO()
    })

    // Add all the game objects to an array. The cows array is "deconstructed" into individual cows using the
    // deconstruction operator "...".
    this._allSprites = [this._title, this._fence, this._person, ...this._cows];

    // This is a slight hack to move all the cows a bit in the beginning to make sure that
    // their directions have a chance to randomize a bit.
    for (let i = 0; i < 10; i++) {
      this.tick({ dt: 1.0 / 30 });
    }
  }

  /**
  * Each frame, update the positions of all the game objects.
  */
  tick() {
    // This is the amount of time between frames in seconds. It is passed to all the game object's
    // tick functions.
    let dt = 1.0 / frameRate();

    // p5.js has a quirk that returns weird values for frameRate() before draw is called so skip those
    // frames.
    if (!dt || !isFinite(dt) || isNaN(dt)) { return; }

    // If one of the arrow keys is pressed, then set the motion of the person to move in
    // the appropriate direction. If no key is pressed, set the motion of the person to the
    // zero vector. keyIsDown(key) and the *_ARROW constants are from p5.js.
    if (keyIsDown(LEFT_ARROW)) {
      this._person.setControlledDirection({ direction: MathHelper.VECTOR_LEFT() });
    } else if (keyIsDown(RIGHT_ARROW)) {
      this._person.setControlledDirection({ direction: MathHelper.VECTOR_RIGHT() });
    } else if (keyIsDown(UP_ARROW)) {
      this._person.setControlledDirection({ direction: MathHelper.VECTOR_UP() });
    } else if (keyIsDown(DOWN_ARROW)) {
      this._person.setControlledDirection({ direction: MathHelper.VECTOR_DOWN() });
    } else {
      this._person.setControlledDirection({ direction: MathHelper.VECTOR_ZERO() });
    }

    // If there is currently a cow following the person, then update the motion of the cow
    // based on the position of the person.
    if (this._followingCow) {
      this._followingCow.setTargetPosition({ position: this._person.getPosition() });
    }

    // Update the positon of all the game objects by one frame.
    this._allSprites.forEach(sprite => sprite.tick({ dt: dt }));

    // Test all the cows for possible collisions.
    this._cows.forEach(cow => {
      // If the cow is overlapping the fence, change it's velocity to move in the opposite direction.
      if (this._fence.isOverlapping({ position: cow._position })) {
        // Set the motion to be in the opposite direction.
        cow.setVelocity({ velocity: cow.getVelocity().mult(-1) });
        // Set the movement back one frame.
        cow.tick({ dt: dt });
      }

      // Add some padding to the edge of the screen for where the cow should turn around.
      const gameBounds = createVector(width, height).sub(
        MathHelper.VECTOR_ONE().mult(GameManager._edgeWidth));

      // If the cow is outside the game window, change it's velocity to move in the opposite direction.
      if (!MathHelper.positionInBounds({
        position: cow.getPosition(), boundsPosition: MathHelper.VECTOR_ZERO(), boundsSize: gameBounds
      }
      )) {
        // Set the motion to be in the opposite direction.
        cow.setVelocity({ velocity: cow.getVelocity().mult(-1) });
        // Set the movement back one frame.
        cow.tick({ dt: dt });
      }
    });

    // If the person is overlapping the fence, prevent them from moving any further.
    if (this._fence.isOverlapping({ position: this._person.getPosition() })) {
      // Set the movement back one frame.
      this._person.setPosition({ position: this._person.getPosition().sub(this._person.getVelocity().mult(dt)) });
      // Set the motion to be nothing.
      this._person.setVelocity({ velocity: MathHelper.VECTOR_ZERO() });
    }

    // If there are no cows outside the fence, then the game is won.
    const cowsOutsideFence = this._cows.filter(cow => !MathHelper.positionInBounds({
      position: cow.getPosition(), boundsPosition: this._fence.getPosition(), boundsSize: this._fence.getSize()
    }));
    if (cowsOutsideFence.length === 0) {
      this._descriptionText = GameManager._descriptionSuccess;
      this._descriptionFontSize = GameManager._descriptionSuccessFontSize;
    }
  }

  /**
  * Each frame, draw all the game objects in their new positionsin p5.js.
  */
  draw() {
    // push() saves the transformation for the coordinate system.
    push();

    // background(color) sets the background color each frame. It clears the previous objects from
    // the screen.
    background(GameManager._backgroundColor);

    // translate(x, y) moves the origin of the coordinate system. It's moved to the center of the
    // screen for convenience.
    translate(width / 2, height / 2);

    // Draw the description text.
    textSize(this._descriptionFontSize);
    textFont('Georgia');
    textAlign(CENTER, CENTER);
    fill(GameManager._descriptionColor);
    text(
      this._descriptionText,
      GameManager._descriptionPosition.x,
      GameManager._descriptionPosition.y,
      GameManager._descriptionSize.x,
      GameManager._descriptionSize.y);

    // Draw all the game objects.
    this._allSprites.forEach(sprite => sprite.draw());

    // pop() restores the transformation for the coordinate system in p5.js.
    pop();
  }

  /**
  * This is callen when a key is typed (pressed and released.)
  */
  keyTyped({ key: key }) {
    // When the space bar is pressed, make the first cow within range follow the person, or release the
    // cow if one is alreaday following the person.
    if (key === ' ') {
      // If there is already a cow following the person, then release the cow.
      if (this._followingCow) {
        this._followingCow.unsetTargetPosition();
        this._followingCow = null;
      } else {
        // Find any cows that are near the person.
        let cowsInRange = this._cows.filter(cow =>
          this._person.getPosition().dist(cow.getPosition()) < GameManager._cowRange);

        // If there are cows near the person, then make the first cow that was found follow the person.
        if (cowsInRange.length > 0) {
          this._followingCow = cowsInRange[0];
        }
      }
    }
  }
}

/*
* Load all the resources. This loads the images from external files and sets up the 
* game settings.
*/
GameManager.preload = () => {
  // loadImage(...) is p5.js function to create a p5.js Image. Also set the size and position.
  // TODO: Could be worth encapsulating the title and description text in a class.
  GameManager._titleImage = loadImage('title.png');
  GameManager._titlePosition = createVector(0, -windowHeight / 2 + 60);
  GameManager._titleSize = createVector(400, 60);

  // Set the transform, color and other description test properties.
  GameManager._descriptionPosition = createVector(-250, windowHeight / 2 - 110);
  GameManager._descriptionSize = createVector(480, 80);
  GameManager._descriptionColor = color(255, 255, 255, 220);
  GameManager._descriptionInitial = 
    "Grazing time is over! Can you bring the cows back home? " +
    "Use the arrow keys to move around and press the space bar near a cow " +
    "to start leading it or let it go.";
  GameManager._descriptionInitialFontSize = 18;
  GameManager._descriptionSuccess = "Yay, you've brought all the cows home!";
  GameManager._descriptionSuccessFontSize = 24;

  // Set the target frame rate.
  GameManager._frameRate = 30;
  // _edgeWidth is an invisible border around the edge that the cows and person should not be able to to.
  GameManager._edgeWidth = 80;
  // The background color.
  GameManager._backgroundColor = color(0, 200, 0);
  // How close to a cow the person needs to be to lead it.
  GameManager._cowRange = 50;

  // Preload each class's resources as well. Ideally, this should happen in the classes themselves,
  // but it seems p5.js functions are not available right away.
  // TODO: See if it's possible to do this automatically instead of calling it from here.
  Person.preload();
  Fence.preload();
  Cow.preload();
}

/**
 * This is the base class for game objects. It stores the a game object's image, 
 * position and velocity and has a tick(dt) function to calculate the new position
 * every frame.
 */
class Sprite {
  constructor({ image, size, position, velocity }) {
    this._image = image;
    this._size = size.copy();
    this._position = position.copy();
    this._velocity = velocity.copy();
  }

  /**
   * Advance the animation one frame. For a Sprite, that means updating the position.
   */
  tick({ dt }) {
    // Update the position. Multiplying velocity by dt converts from per second to per frame.
    this._position.add(this.getVelocity().mult(dt));
  }

  /**
   * Draw the game object to the screen.
   */
  draw() {
    // p5.js function to draw the image to the screen at the specified position and size.
    image(
      this._image,
      this._position.x - this._size.x / 2,
      this._position.y - this._size.y / 2,
      this._size.x,
      this._size.y
    );
  }

  /**
   * Change the velocity of the game object.
   */
  setVelocity({ velocity: velocity }) {
    // Vectors are always copied when we don't want their value to be overwritten by a calculation.
    // This is an quirk of p5.Vector implementation.
    this._velocity = velocity.copy();
  }

  /**
  * Get the velocity of the game object.
  */
  getVelocity() {
    return this._velocity.copy();
  }

  /**
  * Change the position of the game object.
  */
  setPosition({ position: position }) {
    this._position = position.copy();
  }

  /**
  * Get the position of the game object.
  */
  getPosition() {
    return this._position.copy();
  }

  /**
  * Change the size of the game object.
  */
  setSize({ size: size }) {
    this._size = size.copy();
  }

  /**
  * Get the size of the game object.
  */
  getSize() {
    return this._size.copy();
  }
}

/**
 * This is the class for game objects that change their image every frame (for example, the cow and person.)
 * to do flipbook style animation.
 */
class AnimatingSprite extends Sprite {
  constructor({ imageLeftArray, imageRightArray, imageUpArray, imageDownArray, size, position, velocity, distancePerFrame }) {
    super({
      image: imageDownArray[0],
      size: size.copy(),
      position: position.copy(),
      velocity: velocity.copy(),
    });

    // These arrays hold the images in sequence for the walking animation in each of the directions.
    this._imageLeftArray = imageLeftArray;
    this._imageRightArray = imageRightArray;
    this._imageUpArray = imageUpArray;
    this._imageDownArray = imageDownArray;

    // This is the distance that the game object can move before switching to the next frame in
    // the sequence. It's better to use distance than time so that the images are flipped faster
    // when the game object moves faster.
    this._distancePerFrame = distancePerFrame;

    // This is how long the game object has been active in seconds. It helps to determine which
    // frame to draw in the seqence of images.
    this._elapsedTime = 0;

    // This is the last image that was drawn. This is useful to maintain the last direction when
    // the velocity is set to zero.
    this._lastImage = this._imageDownArray[0];
  }

  /**
   * This is an internal function that decides which image to draw based on the direction the
   * game object is moving, the last time it was moving and the amount of time that has passed.
   */
  _getImage() {

    // Based on the current direction of motion, set currentImageArray to the appropriate sequence of
    // animation frames. If the game object is not moving, currentImageArray remains undefined.
    let currentImageArray;
    if (this._velocity.x < 0) {
      currentImageArray = this._imageLeftArray;
    } else if (this._velocity.x > 0) {
      currentImageArray = this._imageRightArray;
    } else if (this._velocity.y < 0) {
      currentImageArray = this._imageUpArray;
    } else if (this._velocity.y > 0) {
      currentImageArray = this._imageDownArray;
    }

    // If the currentImageArray is set, then the game object is moving, so set the _lastImage to the
    // next frame in the animation sequence.
    if (currentImageArray) {
      // frameCount is dependent of the time that has passed, the velocity of motion and how 
      // far the game object travels before advancing frames.
      let frameCount = floor(this._elapsedTime * this._velocity.mag() / this._distancePerFrame);

      // Wrap the frameCount around to select an image from the currentImageArray, so the cows and people
      // can display their walking animation.
      this._lastImage = currentImageArray[frameCount % currentImageArray.length];
    }

    return this._lastImage;
  }

  /**
   * Update the position and animation variables.
   */
  tick({ dt }) {
    // Keep track of how much time has passed so that the correct animation frame in the sequence
    // can be determined.
    this._elapsedTime += dt;

    // Set the correct image based on the direction and animation sequence.
    super._image = this._getImage();

    // Call the parent (Sprite's) tick(dt) to have it perform the basic position calculations.
    super.tick({ dt: dt });
  }
}

/**
 * Encapsulates a cow.
 */
class Cow extends AnimatingSprite {
  constructor({ position }) {
    super({
      imageLeftArray: Cow._imageLeftArray,
      imageRightArray: Cow._imageRightArray,
      imageUpArray: Cow._imageUpArray,
      imageDownArray: Cow._imageDownArray,
      distancePerFrame: Cow._distanceFromFrame,

      size: Cow._size.copy(),
      position: position.copy(),
      velocity: MathHelper.VECTOR_ZERO()
    });
  }

  /**
   * Update the position and animation variables.
   */
  tick({ dt }) {
    // If the cow is following the person, then tickTarget(dt) towards the target position.
    // Otherwise, tickNormal(dt) and randomly move about.
    if (this._targetPosition) {
      this._tickTarget({ dt: dt })
    } else {
      this._tickNormal({ dt: dt })
    }

    // Call the parent (AnimatingSprite's) tick(dt) to handle updating the animation sequence and position.
    super.tick({ dt: dt });
  }

  /**
   * This is the following the person case. Set the motion of the cow to be toward the person, but constrain
   * the motion to x and y only. If the cow is close to the person, then don't move at all.
   */
  _tickTarget({ dt }) {
    if (this._position.x > this._targetPosition.x + 40) {
      this._velocity = MathHelper.VECTOR_LEFT().mult(Cow._targetSpeed);
    } else if (this._position.x < this._targetPosition.x - Cow._targetPadding) {
      this._velocity = MathHelper.VECTOR_RIGHT().mult(Cow._targetSpeed);
    } else if (this._position.y > this._targetPosition.y + Cow._targetPadding) {
      this._velocity = MathHelper.VECTOR_UP().mult(Cow._targetSpeed);
    } else if (this._position.y < this._targetPosition.y - Cow._targetPadding) {
      this._velocity = MathHelper.VECTOR_DOWN().mult(Cow._targetSpeed);
    } else {
      this._velocity = MathHelper.VECTOR_ZERO();
    }
  }

  /**
   * This is the normal motion case. With a probability of 1/10 every second, either have
   * the cow move in a random direction or if it is already moving, have it stop.
   */
  _tickNormal({ dt }) {
    let probability = 0.1 * dt;
    let roll = random(0, 1);

    // The 1/10 chance of changing motion has manifested.
    if (roll < probability) {
      // If the cow is moving, stop the cow.
      // Otehrwise, have it move in a random direction.
      if (this._velocity.mag() > 0) {
        this._velocity = MathHelper.VECTOR_ZERO();
      } else {
        this._velocity = random([
          MathHelper.VECTOR_LEFT(),
          MathHelper.VECTOR_RIGHT(),
          MathHelper.VECTOR_UP(),
          MathHelper.VECTOR_DOWN()
        ]).mult(Cow._normalSpeed);
      }
    }
  }

  setTargetPosition({ position }) {
    this._targetPosition = position;
  }

  unsetTargetPosition() {
    this._targetPosition = null;
  }
}

/**
 * Preload all the images for the cow's animation. There are 4 directions and 4 animation frames in each
 * direction's motion.
 */
Cow.preload = () => {
  // This loads all the cow images. Using the ` backtick allows for using variables inside the string.
  Cow._imageLeftArray = Array.from(Array(4).keys()).map(index => loadImage(`cow_left_${index}.png`));
  Cow._imageRightArray = Array.from(Array(4).keys()).map(index => loadImage(`cow_right_${index}.png`));
  Cow._imageUpArray = Array.from(Array(4).keys()).map(index => loadImage(`cow_up_${index}.png`));
  Cow._imageDownArray = Array.from(Array(4).keys()).map(index => loadImage(`cow_down_${index}.png`));

  Cow._size = MathHelper.VECTOR_ONE().mult(128);
  Cow._distanceFromFrame = 2.5;

  // This is how far from the target the cow should be when following.
  Cow._targetPadding = 40;
  // This is the normal cow speed.
  Cow._normalSpeed = 20;
  // This is the speed of the cow when following.
  Cow._targetSpeed = 40;
}

/**
 * Encapsulates the person.
 */
class Person extends AnimatingSprite {
  constructor({ position }) {
    super({
      imageLeftArray: Person._imageLeftArray,
      imageRightArray: Person._imageRightArray,
      imageUpArray: Person._imageUpArray,
      imageDownArray: Person._imageDownArray,
      distancePerFrame: Person._distanceFromFrame,

      size: Person._size.copy(),
      position: position.copy(),
      velocity: MathHelper.VECTOR_ZERO()
    });
  }

  /**
   * Set the direction that the person is moving. Should be a unit vector or zero vector.
   */
  setControlledDirection({ direction }) {
    this._velocity = direction.copy().mult(Person._speed);
  }
}

/**
 * Preload all the images for the person's animation. There are 4 directions and 3 animation frames in each
 * direction's motion.
 */
Person.preload = () => {
  // This loads all the person images.
  Person._imageLeftArray = Array.from(Array(3).keys()).map(index => loadImage(`person_left_${index}.png`));
  Person._imageRightArray = Array.from(Array(3).keys()).map(index => loadImage(`person_right_${index}.png`));
  Person._imageUpArray = Array.from(Array(3).keys()).map(index => loadImage(`person_up_${index}.png`));
  Person._imageDownArray = Array.from(Array(3).keys()).map(index => loadImage(`person_down_${index}.png`));

  Person._size = createVector(32, 32);
  Person._distanceFromFrame = 2.5;
  Person._speed = 30;
}

/**
 * Encapsulates the fence.
 */
class Fence extends Sprite {
  constructor({ position }) {
    super({
      image: Fence._image,
      size: Fence._size.copy(),
      position: position.copy(),
      velocity: MathHelper.VECTOR_ZERO()
    });
  }

  /**
   * Tests whether the given position overlaps any part of the fence.
   */
  isOverlapping({ position: position }) {
    // outerFenceBound is a a little bigger than the fence image.
    const outerFenceBoundSize = this.getSize().add(MathHelper.VECTOR_ONE().mult(Fence._edgeWidth / 2));
    // innerFenceBound is a little smaller than the fence image.
    const innerFenceBoundSize = this.getSize().sub(MathHelper.VECTOR_ONE().mult(Fence._edgeWidth / 2));
    // openingPosition is the center of where the opening is.
    const openingPosition = this.getPosition().sub(createVector(0, this._size.y / 2));

    // Test all the bounds.
    const isInOuterFenceBound = MathHelper.positionInBounds({
      position: position, boundsPosition: this._position, boundsSize: outerFenceBoundSize
    });
    const isInInnerFenceBound = MathHelper.positionInBounds({
      position: position, boundsPosition: this._position, boundsSize: innerFenceBoundSize
    });
    const isInOpening = MathHelper.positionInBounds({
      position: position, boundsPosition: openingPosition, boundsSize: Fence._openingSize
    });

    // If the position is between the outerFenceBound and innerFenceBound, but not in the
    // fence opening, then return true. Otherwise, return false.
    return isInOuterFenceBound && !isInInnerFenceBound && !isInOpening;
  }
}

/**
 * Preload the fence image.
 */
Fence.preload = () => {
  Fence._image = loadImage(`fence.png`);
  Fence._size = MathHelper.VECTOR_ONE().mult(400);
  Fence._edgeWidth = 100;
  Fence._openingSize = createVector(100, Fence._edgeWidth);
}

/**
 * This contains helpful math functions.
 */
const MathHelper = {
  /**
   * Tests whether the given position is withing the specified bounds.
   */
  positionInBounds: ({ position, boundsPosition, boundsSize }) =>
    (position.x > boundsPosition.x - boundsSize.x / 2 &&
      position.x < boundsPosition.x + boundsSize.x / 2 &&
      position.y > boundsPosition.y - boundsSize.y / 2 &&
      position.y < boundsPosition.y + boundsSize.y / 2),

  /**
   * Returns frequently used vectors. Vector's are created each time so that new copies are 
   * returned and accidental overwriting is much less likely.
   */
  VECTOR_ZERO: () => createVector(0, 0),
  VECTOR_ONE: () => createVector(1, 1),
  VECTOR_LEFT: () => createVector(-1, 0),
  VECTOR_RIGHT: () => createVector(1, 0),
  VECTOR_UP: () => createVector(0, -1),
  VECTOR_DOWN: () => createVector(0, 1)

};
Object.freeze(MathHelper);