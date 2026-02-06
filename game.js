const WIDTH = 960;
const HEIGHT = 540;

const HILLS = {
  K90:  { name: "Normal Hill K90",  k: 90,  hs: 100 },
  K120: { name: "Large Hill K120",  k: 120, hs: 135 },
  K200: { name: "Flying Hill K200", k: 200, hs: 225 }
};

let selectedHill = HILLS.K90;

class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }
  create() {
    this.add.text(WIDTH/2, 80, "DELUXE SKI JUMP 2", { font: "32px monospace", fill: "#000" }).setOrigin(0.5);

    let y = 180;
    Object.values(HILLS).forEach(hill => {
      this.add.text(WIDTH/2, y, `${hill.name}\n(K=${hill.k}, HS=${hill.hs})`, {
        font: "20px monospace", fill: "#000", backgroundColor: "#fff", padding: { x: 10, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        selectedHill = hill;
        this.scene.start("Game");
      });
      y += 90;
    });

    this.add.text(WIDTH/2, 470, "Kliknij skocznię aby zacząć", { font: "16px monospace", fill: "#000" }).setOrigin(0.5);
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  preload() {
    this.load.spritesheet("jumper", "assets/jumper.png", { frameWidth: 32, frameHeight: 32 });
    this.load.image("bg_sky", "assets/bg_sky.png");
    this.load.image("bg_mountains", "assets/bg_mountains.png");
    this.load.image("hill", "assets/hill.png");
  }

  create() {
    this.state = "RUN";
    this.distance = 0;
    this.wind = Phaser.Math.Between(-15, 15);
    this.gate = 10;
    this.score = 0;
    this.best = localStorage.getItem("best") || 0;

    this.add.image(WIDTH/2, HEIGHT/2, "bg_sky").setScrollFactor(0.2);
    this.add.image(WIDTH/2, HEIGHT/2, "bg_mountains").setScrollFactor(0.5);

    this.anims.create({ key: "run", frames: this.anims.generateFrameNumbers("jumper", { start:0, end:3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "jump", frames: this.anims.generateFrameNumbers("jumper", { start:4, end:5 }), frameRate: 5 });
    this.anims.create({ key: "fly", frames: this.anims.generateFrameNumbers("jumper", { start:6, end:9 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "telemark", frames: this.anims.generateFrameNumbers("jumper", { start:10, end:12 }), frameRate: 10 });

    this.curve = new Phaser.Curves.CubicBezier(
      new Phaser.Math.Vector2(150, 360),
      new Phaser.Math.Vector2(400, 300),
      new Phaser.Math.Vector2(650, 220),
      new Phaser.Math.Vector2(900, 360)
    );
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff);
    this.curve.draw(graphics);

    this.jumper = this.physics.add.sprite(150, 360, "jumper").play("run");
    this.jumper.setOrigin(0.5, 1);
    this.jumper.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.jumper, true, 0.05, 0.05);

    this.uiText = this.add.text(10, 10, "", { font: "16px monospace", fill: "#fff" }).setScrollFactor(0);

    this.input.keyboard.on("keydown-SPACE", () => { if (this.state === "RUN") this.jump(); });
    this.input.keyboard.on("keydown-UP", () => { if (this.state === "FLY") this.jumper.angle -= 2; });
    this.input.keyboard.on("keydown-DOWN", () => { if (this.state === "FLY") this.jumper.angle += 2; });
    this.input.on("pointerdown", () => { if (this.state === "RUN") this.jump(); });
  }

  jump() {
    this.state = "FLY";
    this.jumper.play("jump");
    this.jumper.setVelocity(200 + this.gate*5, -400 - this.gate*2);
  }

  applyAerodynamics() {
    const rad = Phaser.Math.DegToRad(this.jumper.angle);
    const lift = Math.cos(rad) * 10;
    const drag = Math.abs(Math.sin(rad)) * 3;
    this.jumper.setVelocityY(this.jumper.body.velocity.y - lift);
    this.jumper.setVelocityX(this.jumper.body.velocity.x - drag + this.wind*0.05);
  }

  checkLanding() {
    if (this.jumper.y >= 360) {
      this.state = "LAND";
      this.jumper.setVelocity(0,0);
      this.jumper.y = 360;
      this.jumper.play("telemark");

      const judges = [];
      const telemark = Math.abs(this.jumper.angle) < 10;
      for (let i=0;i<5;i++){
        let note = 18;
        if (!telemark) note -= 3;
        judges.push(note + Phaser.Math.Between(-1,1));
      }
      judges.sort();
      const style = judges[1]+judges[2]+judges[3];
      const distScore = (this.distance - selectedHill.k)*1.8 + 60;
      this.score = Math.floor(style + distScore);
      this.best = Math.max(this.best, this.score);
      localStorage.setItem("best", this.best);

      this.time.delayedCall(2000, ()=>this.scene.start("Menu"));
    }
  }

  update() {
    if (this.state === "RUN") {
      this.jumper.play("run", true);
      this.jumper.x += 2 + this.gate*0.1;
      this.distance = this.jumper.x - 150;
    }

    if (this.state === "FLY") {
      this.applyAerodynamics();
      this.distance += this.jumper.body.velocity.x*0.02;
      this.jumper.play("fly", true);
      this.checkLanding();
    }

    this.uiText.setText(
`SKOCZNIA: ${selectedHill.name}
STATE: ${this.state}
GATE: ${this.gate}
WIND: ${this.wind}
DIST: ${Math.floor(this.distance)} m
SCORE: ${this.score}
BEST: ${this.best}

SPACE / TAP – wybicie
UP / DOWN – lot`
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  physics: { default: "arcade", arcade: { gravity: { y: 900 } } },
  scene: [MenuScene, GameScene]
});
