const WIDTH = 960;
const HEIGHT = 540;

// ===== SKOCZNIE =====
const HILLS = {
  K90:  { name: "Normal Hill K90",  k: 90,  hs: 100, angle: -18 },
  K120: { name: "Large Hill K120",  k: 120, hs: 135, angle: -16 },
  K200: { name: "Flying Hill K200", k: 200, hs: 225, angle: -14 }
};

let selectedHill = HILLS.K90;

// ================= MENU SCENE =================
class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    this.add.text(WIDTH/2, 80, "SKOKI NARCIARSKIE", { font: "32px monospace", fill: "#000" }).setOrigin(0.5);

    let y = 180;
    Object.values(HILLS).forEach(hill => {
      const btn = this.add.text(WIDTH/2, y, `${hill.name}\n(K=${hill.k}, HS=${hill.hs})`, {
        font: "20px monospace", fill: "#000", backgroundColor: "#fff", padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        selectedHill = hill;
        this.scene.start("Game");
      });
      y += 90;
    });

    this.add.text(WIDTH/2, 470, "Kliknij skocznię aby zacząć", { font: "16px monospace", fill: "#000" }).setOrigin(0.5);
  }
}

// ================= GAME SCENE =================
class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  preload() {
    // Sprites i tła (musisz podstawić własne pliki)
    this.load.spritesheet("jumper", "assets/jumper.png", { frameWidth: 32, frameHeight: 32 });
    this.load.image("hill", "assets/hill.png");
    this.load.image("bg_sky", "assets/bg_sky.png");
    this.load.image("bg_mountains", "assets/bg_mountains.png");
  }

  create() {
    this.state = "RUN";
    this.distance = 0;
    this.wind = Phaser.Math.Between(-15, 15);
    this.gate = 10;
    this.score = 0;
    this.best = localStorage.getItem("best") || 0;

    // ===== TŁO =====
    this.add.image(WIDTH/2, HEIGHT/2, "bg_sky").setScrollFactor(0.2);
    this.add.image(WIDTH/2, HEIGHT/2, "bg_mountains").setScrollFactor(0.5);

    // ===== ANIMACJE SKOCZKA =====
    this.anims.create({ key: "run", frames: this.anims.generateFrameNumbers("jumper", { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "fly", frames: this.anims.generateFrameNumbers("jumper", { start: 4, end: 7 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: "land", frames: this.anims.generateFrameNumbers("jumper", { start: 8, end: 11 }), frameRate: 10 });

    // ===== SKOCZNIA =====
    this.hill = this.physics.add.staticImage(800, 360, "hill").setRotation(Phaser.Math.DegToRad(selectedHill.angle));

    // ===== SKOCZEK =====
    this.jumper = this.physics.add.sprite(150, 280, "jumper").play("run");
    this.jumper.setAngle(selectedHill.angle);
    this.jumper.setCollideWorldBounds(true);
    this.physics.add.collider(this.jumper, this.hill, () => this.land());

    // ===== KAMERA =====
    this.cameras.main.startFollow(this.jumper);
    this.cameras.main.setLerp(0.05, 0.05);

    // ===== UI =====
    this.uiText = this.add.text(10, 10, "", { font: "16px monospace", fill: "#fff" }).setScrollFactor(0);

    // ===== KONTROLKI =====
    this.input.keyboard.on("keydown-SPACE", () => { if (this.state === "RUN") this.jump(); });
    this.input.keyboard.on("keydown-UP", () => { if (this.state === "FLY") this.jumper.angle -= 2; });
    this.input.keyboard.on("keydown-DOWN", () => { if (this.state === "FLY") this.jumper.angle += 2; });
    this.input.on("pointerdown", () => { if (this.state === "RUN") this.jump(); });
  }

  jump() {
    const timing = Phaser.Math.Clamp(1 - Math.abs(this.jumper.x - 320) / 120, 0.6, 1.2);
    const speed = 180 + this.gate * 6;
    this.jumper.setVelocity(speed * timing, -420 * timing);
    this.state = "FLY";
    this.jumper.play("fly", true);
  }

  applyAerodynamics() {
    const rad = Phaser.Math.DegToRad(this.jumper.angle);
    const lift = Math.cos(rad) * 10;
    const drag = Math.abs(Math.sin(rad)) * 3;
    this.jumper.setVelocityY(this.jumper.body.velocity.y - lift);
    this.jumper.setVelocityX(this.jumper.body.velocity.x - drag + this.wind * 0.05);
  }

  land() {
    if (this.state !== "FLY") return;
    this.state = "STOP";
    const angle = Math.abs(this.jumper.angle);
    const telemark = angle < 10;

    let judges = [];
    for (let i = 0; i < 5; i++) {
      let note = 18;
      if (angle > 25) note -= 3;
      if (telemark) note += 2;
      judges.push(note + Phaser.Math.Between(-1, 1));
    }

    judges.sort();
    const style = judges[1] + judges[2] + judges[3];
    const distScore = (this.distance - selectedHill.k) * 1.8 + 60;

    this.score = Math.floor(distScore + style);
    this.best = Math.max(this.best, this.score);
    localStorage.setItem("best", this.best);

    this.jumper.play("land");
    this.time.timeScale = 0.4;
    setTimeout(() => this.time.timeScale = 1, 400);
    this.time.delayedCall(2000, () => { this.scene.start("Menu"); });
  }

  update() {
    if (this.state === "RUN") {
      this.jumper.setVelocityX(180 + this.gate * 6);
      this.jumper.play("run", true);
    }

    if (this.state === "FLY") {
      this.applyAerodynamics();
      this.distance += this.jumper.body.velocity.x * 0.02;
      this.jumper.play("fly", true);
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

// ================= GAME CONFIG =================
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 900 } }
  },
  scene: [MenuScene, GameScene]
});
