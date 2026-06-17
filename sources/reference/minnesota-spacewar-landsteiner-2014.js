/*
  A recontsruction of Minnesota Spacewar (v.1.3.1)
  (c) 2014, N.Landsteiner, www.masswerk.at
  All rights reserved.

  Features hyperspace invisibility, salvoes, torpedo gravity, and partial damage.
  Includes a reconstruction of Peter Samson's classic "Expensive Planetarium",
  and a Conway's Game-of-Life-style sun.
  May be switched to the original MIT-gameplay (MITmode = true).

  Original Minnesota Spacewar 1966-1968 by Albert W. Kuhfeld.
  Original (MIT) Spacewar! 1961/62 by Stephen Russell, Peter Samson, Dan Edwards,
  and Martin Graetz, together with Alan Kotok, Steve Piner, and Robert A Saunders.
*/

var minnesotaSpacewar = new function() {

// runtime constants

var canvasId =            'spacewarCanvas',
	width =               640,
	height =              512,
	frameDelay =          36,
	starIntensities =     [210, 190, 160, 110],
	starIntensitiesBlue = [220, 200, 170, 120];

// config: switches (might be flipped on the fly, see API)

var salvoes =          true,
	torpedoGravity =   false,
	dorpedoesExtdSup = false,
	partialDamage =    false,
	sunKills =         true,
	lowGravity =       false,
	showStarfield =    true,
	hyperspaceActive = true,
	MITmode =          false,
	showScore =        false,
	showTrails =       false,
	bluePhosphor =     true,
	fuzzyTorpedoes =   false,
	gameOfLifeSun =    false,
	sunActive =        true;

// config: game constants (general values as Spacewar! 4.x)

var gravity =             100,
	torpedoMass =         0.8,
	torpedoesMax =        20,
	torpedoesExtdMax =    31, // MIT
	shipAngularSpeed =    Math.PI/180*2,
	shipMaxVelocity =     5,
	collisionRadius =     230,
	particleLifetime =    10,  // in frames
	gameCoolingTime =     192, // (like MIT-Spacewar! 2 x torp life time)
	fuzzyTorpsCf =        0.35,

// Minnesota Spacewar specific:
	MSWshipAcceleration = 0.02,
	MSWfuelSupply =       Math.floor(1000/frameDelay*120), // 2 min
	MSWtorpedoSpeed =     2.4,
	MSWtorpsConcurrent =  4,
	MSWtorpedoLifeTime =  Math.floor(1000/frameDelay*15), // 15 sec
	MSWtorpedoCooling =   Math.floor(1000/frameDelay), // 1 sec
	MSWsalvoCooling =     Math.floor(1000/frameDelay), // 1 sec

// MIT-mode (like Spacewar! 4.x):
	MITshipAcceleration = 0.006,
	MITfuelSupply =       Math.floor(1000/frameDelay*30), // 30 sec
	MITtorpedoSpeed =     2.2,
	MITtorpedoLifeTime =  97, // aprox. 2.7 sec
	MITtorpedoCooling =   20, // topedo spacing in frames
	MIThyperTime =        96, // total frames in hyperspae
	MIThyperBreakout =    64, // frames to display as spot
	MIThyperRecharge =    128, // frames recharging
	MIThyperBreachP =     8;  // propability for breaking (in p cases)

// derived constants

var centerX = width/2,
	centerY = height/2,
	maxX = width-1,
	maxY = height-1,
	tau = Math.PI*2,
	performanceNow = Boolean(window.performance);

// game globals

var ships, shipOutlineOffset, shipAccelCf, shipSetupDx, shipSetupDy, shipDecelCf,
	grav, gravTorp, torpedoSpeed, torpMax, torpCooling, fuelMax, torpedoes=[], particles=[],
	score1, score2, scoreDraws, scoreStrings={},
	useMITtorps, useMITAnimations, useMITfuel, useMITOutlines, useMITHyperspace, useMITGravity, useMSWAftertime, useRetroThrusters, sun, dimmStars,
	timer, gameCnt, gameState=0, inited=false, paused=false;

var prtlDmg= {
	left:   1,
	right:  2,
	thrust: 4,
	retro:   8
};

var gameStates= {
	idle: 0,
	splashscreen: 1,
	playing: 2,
	scorer: 3
};

// objects & methods

// ships

function Ship(id) {
	this.id=id;
	this.particles=[];
	this.damageMap=[];
	this.reset();
}
Ship.prototype = {
	MSWexplosionRadiusMin: 7,
	MSWexplosionRadiusMax: 30,
	MSWexplosionSteps: 0,
	MSWexplosionMasks: [],
	initMasks: function() {
		var i, r, l, x, y, m, my, y2, r2, proto=Ship.prototype;
		for (i=0, r=proto.MSWexplosionRadiusMin, l=proto.MSWexplosionRadiusMax-proto.MSWexplosionRadiusMin; i<l; i++, r++) {
			m=proto.MSWexplosionMasks[i]=new Array();
			r2=r*r;
			for (y=0; y<r; y++) {
				my=m[r-y-1]=new Array();
				y2=y*y;
				for (var x=0; x<r; x++) {
					my[r-x-1]=(x*x+y2<=r2);
				}
			}
		}
		proto.MSWexplosionSteps=proto.MSWexplosionRadiusMax-proto.MSWexplosionRadiusMin;
	},
	reset: function() {
		if (useMITGravity) {
			this.x= (this.id==1)? centerX+shipSetupDx:centerX-shipSetupDx;
			this.y= (this.id==1)? centerY-shipSetupDy:centerY+shipSetupDy;
		}
		else {
			var dx = shipSetupDx*0.6,
				dy = shipSetupDy*0.6;
			this.x= (this.id==1)? centerX+dx:centerX-dx;
			this.y= (this.id==1)? centerY-dy:centerY+dy;
		}
		this.state=1;
		this.r= (this.id==1)? tau*.25:tau*.75;
		this.cosr=Math.cos(this.r);
		this.sinr=Math.sin(this.r);
		this.sinHb=Math.sin(-this.r);
		this.cosHb=Math.cos(-this.r);
		this.dx=0;
		this.dy=0;
		this.fuel=0;
		this.shotsFired=0;
		this.torpedoes=0;
		this.salvoCnt=0;
		this.particlesTop=0;
		this.thrust=false;
		this.retro=false;
		this.turnLeft=false;
		this.turnRight=false;
		this.fire=false;
		this.fired=false;
		this.hyperspace=false;
		this.hyperCnt=0;
		this.hyperBreachP=MIThyperBreachP;
		this.torpCnt=0;
		this.damage=0;
		this.damageMap.length=0;
		// partialDamage (prepare anyway)
		var m=[], n, i;
		for (n in prtlDmg) m.push({v: prtlDmg[n], w: Math.random()});
		m.sort(function(a,b) { return a.w-b.w; });
		for (i=0; i<4; i++) this.damageMap.push(m[i].v);
	},
	move: function() {
		var dx, dy, d, f, tp, i, l;
		if (this.torpCnt>0) this.torpCnt--;
		if (this.state>0) {
			if (!useRetroThrusters) this.retro=false;
			if (partialDamage) {
				if (this.turnRight && this.damage&prtlDmg.right) this.turnRight=false;
				if (this.turnLeft && this.damage&prtlDmg.left) this.turnLeft=false;
				if (this.damage&prtlDmg.thrust) this.thrust=false;
				if (this.damage&prtlDmg.retro) this.retro=false;
			}
			if (useMITHyperspace && hyperspaceActive) {
				if (this.hyperCnt > 0) {
					if (--this.hyperCnt==0) {
						if (--this.hyperBreachP<Math.random()*MIThyperBreachP) {
							this.explode();
						}
						else {
							this.hyperCnt=-MIThyperRecharge;
						}
					}
					this.hyperspace=false;
					return;
				}
				else if (this.hyperCnt<0) {
					this.hyperCnt++;
					this.hyperspace=false;
				}
				else if (this.hyperspace) {
					this.hyperspace=false;
					if (this.hyperCnt==0) {
						this.hyperCnt=MIThyperTime;
						this.x=Math.floor(Math.random()*width);
						this.y=Math.floor(Math.random()*height);
						this.dx=Math.random()*MSWshipAcceleration*64;
						this.dy=Math.random()*MSWshipAcceleration*64;
						this.r=Math.random()*tau;
						this.rotate(0);
						return;
					}
				}
			}
			if (this.turnLeft || this.turnRight) this.rotate((this.turnLeft)? -1:1);
			if (sunActive && !sunKills && this.x==centerX && this.y==centerY) {
				this.x=maxX;
				this.y=0;
				this.dx=0;
				this.dy=0;
				return;
			}
			if ((this.thrust || this.retro) && this.state>0 && this.fuel<fuelMax) {
				if (this.retro) {
					this.dx-=this.cosr*shipDecelCf;
					this.dy-=this.sinr*shipDecelCf;
				}
				else {
					this.dx+=this.cosr*shipAccelCf;
					this.dy+=this.sinr*shipAccelCf;
				}
				this.limitVelocity(shipMaxVelocity);
				this.fuel++;
			}
			if (sunActive) {
				dx=centerX-this.x;
				dy=centerY-this.y;
				d=dx*dx+dy*dy;
				if (d<=sun.captureRadius) {
					if (sunKills) {
						this.explode(true);
						return;
					}
					else {
						this.x=centerX;
						this.y=centerY;
						return;
					}
				}
				f=grav/d/Math.sqrt(d);
				this.dx+=dx*f;
				this.dy+=dy*f;
			}
		}
		if (this.state!=0) {
			this.x+=this.dx;
			this.y+=this.dy;
			if (this.x>maxX) {
				this.x-=width;
			}
			else if (this.x<0) {
				this.x+=width;
			}
			if (this.y>maxY) {
				this.y-=height;
			}
			else if (this.y<0) {
				this.y+=height;
			}
		}
		if (this.state>0) {
			if (this.fire && this.shotsFired<torpMax) {
				if (!this.torpCnt && (useMITtorps || ((salvoes || !this.fired) && this.torpedoes<MSWtorpsConcurrent))) {
					tp=null;
					for (i=0, l=torpedoes.length; i<l; i++) {
						if (torpedoes[i].state==0) {
							tp=torpedoes[i];
							break;
						}
					}
					if (!tp) {
						tp=new Torpedo();
						torpedoes.push(tp);
					}
					tp.x=this.x+this.cosr*12;
					tp.y=this.y+this.sinr*12;
					tp.state=(useMITtorps)? MITtorpedoLifeTime:MSWtorpedoLifeTime;
					if (fuzzyTorpedoes) {
						tp.state-=Math.floor(Math.random()*tp.state*fuzzyTorpsCf);
						var r=this.r+(Math.random()-0.5)*Math.PI*fuzzyTorpsCf/4,
							s=torpedoSpeed*(1-Math.random()*fuzzyTorpsCf);
						tp.dx=this.dx+Math.cos(r)*s;
						tp.dy=this.dy+Math.sin(r)*s;
					}
					else {
						tp.dx=this.dx+this.cosr*torpedoSpeed;
						tp.dy=this.dy+this.sinr*torpedoSpeed;
					}
					tp.owner=this.id;
					this.torpCnt=torpCooling;
					this.shotsFired++;
					this.torpedoes++;
					if (salvoes) {
						if (++this.salvoCnt == 4) {
							if (!useMITtorps) this.torpCnt+=MSWsalvoCooling;
							this.salvoCnt=0;
						}
					}
					this.fired=true;
				}
			}
			else {
				if (this.fired && salvoes && this.salvoCnt>1 && !useMITtorps) this.torpCnt=+MSWsalvoCooling-1;
				this.salvoCnt=0;
				this.fired=false;
			}
		}
	},
	rotate: function(a) {
		this.r+=shipAngularSpeed*a;
		if (this.r<0) {
			this.r+=tau;
		}
		else if (this.r>tau) {
			this.r-=tau;
		}
		this.sinr=Math.sin(this.r);
		this.cosr=Math.cos(this.r);
		this.sinHb=Math.sin(-this.r);
		this.cosHb=Math.cos(-this.r);
	},
	limitVelocity: function(v) {
		if (this.dx || this.dy) {
			var d=Math.sqrt(this.dx*this.dx+this.dy*this.dy);
			if (d>v) {
				var f=v/d;
				this.dx*=f;
				this.dy*=f;
			};
		}
	},
	scaleVelocity: function(v) {
		this.dx*=v;
		this.dy*=v;
	},
	decrementTorpedoes: function() {
		this.torpedoes--;
	},
	explode: function(inSun) {
		if (useMITAnimations) {
			this.state=-1;
			this.particlesTop=0;
			if (inSun) this.scaleVelocity(0.7);
			seedParticles(this, 50, 4, 6.5, particleLifetime, true);
			seedParticles(this, 70, 6, 2, particleLifetime, false);
			seedParticles(this, 60, 5, 1, particleLifetime, false);
			seedParticles(this, 60, 5, 0.5, particleLifetime, false);
		}
		else {
			this.state=-this.MSWexplosionSteps;
			this.dx=this.dy=0;
		}
	},
	draw: function() {
		var i, ot, p;
		if (this.state>0) {
			if (useMITHyperspace && hyperspaceActive && this.hyperCnt>0) {
				if (this.hyperCnt<=MIThyperBreakout) CRT.plot(this.x, this.y, 255);
				return;
			}
			if (!(hyperspaceActive && this.hyperspace && !useMITHyperspace)) {
				drawOutline(shipOutlines[shipOutlineOffset+this.id], this.x, this.y, this.sinr, this.cosr, false);
			}
			if (this.retro) {
				var offset1=(useMITOutlines) ? ((this.id==1)?15:10):((this.id==1)?13:9)+Math.round(Math.random()),
					offset2=(useMITOutlines)? offset1+3+Math.floor(Math.random()*6):offset1+2+Math.floor(Math.random()*5),
					exhaust= [offset1, 0, 4, offset2, 0, 0];
				drawOutline(exhaust, this.x, this.y, this.sinr, this.cosr, useMITOutlines);
			}
			else if (this.thrust) {
				var offset1=(useMITOutlines) ? 11:((this.id==1)?11:9)+Math.round(Math.random()),
					offset2=(useMITOutlines)? 14+Math.floor(Math.random()*12):14+Math.floor(Math.random()*9),
					exhaust= [-offset1, 0, 4, -offset2, 0, 0];
				drawOutline(exhaust, this.x, this.y, this.sinr, this.cosr, useMITOutlines);
			}
		}
		else if (this.state<0) {
			if (useMITAnimations) {
				if (drawParticles(this)==0) {
					this.state=0;
				}
			}
			else {
				var step=this.MSWexplosionSteps+this.state,
					r=this.MSWexplosionRadiusMin+step,
					mask=this.MSWexplosionMasks[step],
					c=step/this.MSWexplosionSteps,
					a = (c<0.5)? 255: 15+Math.floor(240*(1-(c-0.5)/0.5)),
					px=Math.round(this.x), py=Math.round(this.y),
					x1=px-r, y1=py-r, x2=px+r-1, y2=py+r-1;
				for (var y=0; y<r; y++) {
					var m=mask[y];
					for (var x=0; x<r; x++) {
						if (m[x] && Math.random()<0.075) {
							CRT.plot(x1+x, y1+y, a);
							CRT.plot(x2-x, y1+y, a);
							CRT.plot(x1+x, y2-y, a);
							CRT.plot(x2-x, y2-y, a);
						}
					}
				}
				this.state++;
			}
		}
	},
	drawScaled: function(s, dotted) {
		drawOutlineScaled(shipOutlines[shipOutlineOffset+this.id], this.x, this.y, this.sinr, this.cosr, dotted, s);
	}
};
Ship.prototype.initMasks();

// torpedoes

function Torpedo() {
	this.x=0;
	this.y=0;
	this.dx=0;
	this.dy=0;
	this.state=0;
	this.owner=0;
	this.particlesTop=0;
	this.particles=[];
}
Torpedo.prototype = {
	move: function() {
		this.x+=this.dx;
		this.y+=this.dy;
		if (this.state>0 && torpedoGravity && sunActive) {
			var dx=centerX-this.x,
				dy=centerY-this.y,
				d=dx*dx+dy*dy,
				vmax=Math.sqrt(this.dx*this.dx+this.dy*this.dy)*1.2,
				f=gravTorp/d/Math.sqrt(d);
				if (f>1.75) f=1.75;
			this.dx+=dx*f;
			this.dy+=dy*f;
			var v=Math.sqrt(this.dx*this.dx+this.dy*this.dy);
			if (vmax && v>vmax) {
				f=vmax/v;
				this.dx*=f;
				this.dx*=f;
			}
		}
		if (this.x>maxX) {
			this.x-=width;
		}
		else if (this.x<0) {
			this.x+=width;
		}
		if (this.y>maxY) {
			this.y-=height;
		}
		else if (this.y<0) {
			this.y+=height;
		}
		if (this.state>0 && --this.state==1) this.explode(false);
	},
	draw: function() {
		if (this.state>0) {
			CRT.plot(Math.round(this.x), Math.round(this.y));
		}
		else if (this.state<0) {
			drawParticles(this);
			if (++this.state==0) {
				ships[this.owner].decrementTorpedoes();
			}
		}
	},
	explode: function(hit) {
		if (useMITAnimations || (hit && partialDamage)) {
			var lt=(hit)? Math.floor(particleLifetime*1.25):Math.floor(particleLifetime*0.7);
			this.dx*=(hit)? 0.9: 0.25;
			this.dy*=(hit)? 0.9: 0.25;
			this.particlesTop=0;
			seedParticles(this,(hit)? 15:5, 1, (hit)? 2:1.9, lt, false);
			this.state=-lt;
		}
		else {
			this.state=0;
			ships[this.owner].decrementTorpedoes();
		}
	}
};

function moveTorpedoes() {
	var tp, l, i;
	for (i=0, l=torpedoes.length; i<l; i++) {
		tp=torpedoes[i];
		if (tp.state!=0) tp.move();
	}
}

function drawTorpedoes() {
	var tp, l, i;
	for (i=0, l=torpedoes.length; i<l; i++) {
		tp=torpedoes[i];
		if (tp.state!=0) tp.draw();
	}
}

function resetTorpedoes() {
	var tp, l, i;
	for (i=0, l=torpedoes.length; i<l; i++) {
		tp=torpedoes[i];
		tp.state=0;
		tp.particlesTop=0;
	}
}

// hit detection
// (employing Steve Russell's "basic trick":
// rotating the universe to fit the hit-boxes of upright ships)

function checkHits(ship, objects, objectsMoved) {
	var odx, ody, kx1, kx2, ky1, ky2, hitboxes=shipHitBoxes[shipOutlineOffset+ship.id], hbl=hitboxes.length;
	if (!objectsMoved) {
		// distortions for hit-boxes based on ship's speed
		odx=ship.cosHb*ship.dx-ship.sinHb*ship.dy;
		ody=ship.sinHb*ship.dx+ship.cosHb*ship.dy;
		if (odx>0) {
			kx1=-odx;
			kx2=0;
		}
		else {
			kx1=0;
			kx2=-odx;
		}
		if (ody>0) {
			ky1=-odx;
			ky2=0;
		}
		else {
			ky1=0;
			ky2=-odx;
		}
	}
	for (var i=0, l=objects.length; i<l; i++) {
		var o=objects[i];
		if (o.state>0) {
			var dx=o.x-ship.x,
				dy=o.y-ship.y,
				d=dx*dx+dy*dy;
			if (d < 20) { // very close, it's a hit
				if (partialDamage) {
					ship.damage|=ship.damageMap.shift();
					if (ship.damage==15) {
						ship.explode();
						o.state=0;
						return;
					}
					else {
						o.dx=ship.dx;
						o.dy=ship.dy;
						o.explode(true);
						continue;
						// no return here, check for more hits
					}
				}
				else {
					ship.explode();
					o.state=0;
					return;
				}
			}
			if (d < 600) { // max perimeter
				var x=ship.cosHb*dx-ship.sinHb*dy, y=ship.sinHb*dx+ship.cosHb*dy;
				if (objectsMoved) {
					// distortions for hit-boxes based on torpedo's speed
					odx=ship.cosHb*o.dx-ship.sinHb*o.dy;
					ody=ship.sinHb*o.dx+ship.cosHb*o.dy;
					if (odx>0) {
						kx1=0;
						kx2=odx;
					}
					else {
						kx1=odx;
						kx1=0;
					}
					if (ody>0) {
						ky1=0;
						ky2=ody;
					}
					else {
						ky1=ody;
						kxy=0;
					}
				}
				for (var k=0; k<hbl; k++) {
					var b=hitboxes[k];
					if (x>=b.x1+kx1 && x<=b.x2+kx2 && y>=b.y1+ky1 && y<= b.y2+ky2) {
						if (partialDamage) {
							ship.damage|=ship.damageMap.shift();
							if (ship.damage==15) {
								ship.explode();
								o.state=0;
								return;
							}
							else {
								var cx=0, cy=0;
								if (x<b.x1 || x>b.x2) cx=-x;
								if (y<b.y1 || y>b.y2) cy=-y;
								if (cx || cy) {
									o.x=ship.cosr*cx-ship.sinr*cy;
									o.y=ship.sinr*cx+ship.cosr*cy;
								}
								o.dx=ship.dx;
								o.dy=ship.dy;
								o.explode(true);
								break;
								// no return here, check for more hits
							}
						}
						else {
							ship.explode();
							o.state=0;
							return;
						}
					}
				}
			}
		}
	}
}

// particles (attached to object locations and movements)

function Particle(x, y, dx, dy, s) {
	this.x=x;
	this.y=y;
	this.dx=dx;
	this.dy=dy;
	this.s=s;
}

function getParticle(x, y, dx, dy, s) {
	for (var i=0, l=particles.length; i<l; i++) {
		if (particles[i].s==0) {
			var p=particles[i];
			p.x=x;
			p.y=y;
			p.dx=dx;
			p.dy=dy;
			p.s=s;
			return p;
		}
	}
	var p=new Particle(x, y, dx, dy, s);
	particles.push(p);
	return p;
}

function resetParticles() {
	for (var i=particles.length-1; i>=0; i--) particles[i].s=0;
}

function seedParticles(obj, n, r, vel, lt, randLt) {
	for (var i=0; i<n; i++) {
		var a=tau*Math.random(),
			s=Math.cos(a),
			c=Math.sin(a),
			d=r*Math.random(),
			v=Math.random()*vel;
		obj.particles[obj.particlesTop++]= getParticle( s*d, c*d, s*v, c*v, (randLt)? Math.floor(lt*(0.5+0.5*Math.random())):lt );
	}
}

function drawParticles(parentObj) {
	var i, p, n=0, pp=parentObj.particles;
	for (i=parentObj.particlesTop-1; i>=0; i--) {
		p=pp[i];
		if (p.s>0) {
			CRT.plot(Math.round(parentObj.x+p.x), Math.round(parentObj.y+p.y), 245-(particleLifetime+this.s)*2);
			p.x+=p.dx;
			p.y+=p.dy;
			if (--p.s==0) {
				p.s=-1;
			}
			else {
				n++;
			}
		}
	}
	if (n==0) {
		for (i=parentObj.particlesTop-1; i>=0; i--) pp[i].s=0;
		parentObj.particlesTop=0;
	}
	return n;
}

// outlines, drawing, hit-boxes (same for both ships, lower bounds first)

var shipHitBoxes = [
	// Minnesota
	[ // flying wedge
		{x1:  0, y1: -3, x2: 9, y2: 3},
		{x1: -9, y1: -5, x2: 0, y2: 5}
	],
	[ // arrow (needle)
		{x1:  -5, y1: -3, x2: 10, y2: 3},
		{x1: -10, y1: -4, x2: -5, y2: 4}
	],
	// MIT
	[ // wedge
		{x1:  0, y1: -3, x2: 9, y2: 3},
		{x1: -10, y1: -5, x2: 0, y2: 5}
	],
	[ // needle
		{x1:  -5, y1: -3, x2: 11, y2: 3},
		{x1: -10, y1: -5, x2: -5, y2: 5}
	]
];

var shipOutlines = [
	// x, y, m (1: skip first, 2: skip last, 4: move to)
	// pointing to +x axis (rotation angle 0)
	[ // flying wedge
		 8, 0, 4,
		 7, 0, 0,
		 7,  0, 4,
		-9, -5, 1,
		 7,  0, 4,
		-9,  5, 1,
		-8, -5, 4,
		-8,  5, 3
	],
	[ // arrow (needle)
		 12,  0, 4,
		  8,  0, 0,
		  8, -1, 1,
		 -5, -1, 3,
		  8,  0, 4,
		  8,  1, 1,
		 -5,  1, 3,
		 -5, -4, 4,
		-10, -4, 0,
		 -5, -4, 4,
		 -5,  4, 1,
		-10,  4, 1,
		 -9, -4, 4,
		 -9,  4, 3,
		 -8,  0, 4,
		-10,  0, 0
	],
	// MIT-style
	[ // wedge
		 9, 0, 4,
		 8, 0, 0,
		 7, -1, 1,
		 5, -1, 1,
		 4, -2, 1,
		 2, -2, 1,
		 1, -3, 1,
		-4, -3, 1,
		-5, -2, 1,
		-8, -2, 1,
		-9, -1, 1,
		-10, -1, 1,
		-10,  1, 1,
		-9,  1, 1,
		-8,  2, 1,
		-5,  2, 1,
		-4,  3, 1,
		 1,  3, 1,
		 2,  2, 1,
		 4,  2, 1,
		 5,  1, 1,
		 7,  1, 1,
		 8, 0, 3,
		-2, -3, 4,
		-6, -5, 0,
		-10, -5, 1,
		-10, -4, 1,
		-8, -2, 1,
		-2,  3, 4,
		-6,  5, 0,
		-10,  5, 1,
		-10, 4, 1,
		-8,  2, 1
	],
	[ // needle
		 14,  0, 4,
		 11,  0, 0,
		 11, -1, 1,
		-10, -1, 3,
		 11,  0, 4,
		 11,  1, 1,
		-10,  1, 3,
		 -3, -1, 4,
		 -5, -3, 1,
		-10, -3, 1,
		-10,  3, 1,
		 -5,  3, 1,
		 -3,  1, 3
	]
];

function drawOutline(ot, px, py, sin, cos, dotted) {
	var ox, oy, i=0, l=ot.length;
	while (i<l) {
		var dx=ot[i++],
			dy=ot[i++],
			m=ot[i++],
			x=cos*dx - sin*dy + px,
			y=cos*dy + sin*dx + py;
		if (!(m&4)) drawLine(Math.round(ox), Math.round(oy), Math.round(x), Math.round(y), m&1, m&2, dotted);
		ox=x;
		oy=y;
	}
}

function drawOutlineScaled(ot, px, py, sin, cos, dotted, scale) {
	var ox, oy, i=0, l=ot.length;
	while (i<l) {
		var dy=ot[i++]*scale,
			dx=ot[i++]*scale,
			m=ot[i++],
			x=cos*dx - sin*dy + px,
			y=cos*dy + sin*dx + py;
		if (!(m&4)) drawLine(Math.round(ox), Math.round(oy), Math.round(x), Math.round(y), m&1, m&2, dotted);
		ox=x;
		oy=y;
	}
}

function drawLine(x1, y1, x2, y2, skipFirst, skipLast, dotted, a) {
	var dx=x2-x1, dy=y2-y1, sx=1, sy = 1, fraction, dot=true;
	if (dx<0) {
		sx=-1;
		dx=-dx;
	}
	if (dy<0) {
		sy=-1;
		dy=-dy;
	}
	dx=dx<<1; dy=dy<<1;
	if (!skipFirst) {
		CRT.plot(x1, y1, a);
		if (dotted) dot=!dot;
	}
	if (dy<dx) {
		fraction=dy-(dx>>1);
		while (x1!=x2) {
			if (fraction>=0) {
				y1+=sy;
				fraction-=dx;
			}
			fraction+=dy;
			x1+=sx;
			if (!skipLast || x1!=x2) {
				if (dot) CRT.plot(x1, y1, a);
				if (dotted) dot=!dot;
			}
		}
	}
	else {
		fraction=dx-(dy>>1);
		while (y1!=y2) {
			if (fraction>=0) {
				x1+=sx;
				fraction-=dy;
			}
			fraction+=dx;
			y1 += sy;
			if (!skipLast || y1!=y2) {
				if (dot) CRT.plot(x1, y1, a);
				if (dotted) dot=!dot;
			}
		}
	}
}


// draw a MIT-style sun

var MITSun= new function() {
	var update=true, a=0;
	function draw() {
		var dx=Math.random()*2-1,
			dy=Math.random()*2-1,
			l=Math.floor(9-Math.random()*4),
			i,x,y;
		//if (update) {
			CRT.plot(centerX, centerY, 250);
			for (i=0, x=centerX+dx, y=centerY+dy; i<l; i++, x+=dx, y+=dy) CRT.plot(Math.floor(x), Math.floor(y), 250);
			for (i=0, x=centerX-dx, y=centerY-dy; i<l; i++, x-=dx, y-=dy) CRT.plot(Math.floor(x), Math.floor(y), 250);
		//}
		//update=!update;
	}
	return {
		draw: draw,
		captureRadius: 100
	};
};

// draw a Minnesota-style sun

var MSWSun = new function() {
	var r=20, mask;
	
	function init() {
		var x, y, my, y2, r2=r*r;
		mask=new Array();
		for (y=0; y<r; y++) {
			my=mask[r-y-1]=new Array();
			y2=y*y;
			for (var x=0; x<r; x++) {
				my[r-x-1]=(x*x+y2<=r2);
			}
		}
		mask[r-1][r-1]=false;
	}
	
	function draw() {
		var x, y, v, x1=centerX-r, y1=centerY-r, x2=centerX+r-1, y2=centerY+r-1, m;
		for (y=0; y<r; y++) {
			m=mask[y];
			for (x=0; x<r; x++) {
				if (m[x] && Math.random()<0.2) {
					CRT.plot(x1+x, y1+y);
					CRT.plot(x2-x, y1+y);
					CRT.plot(x1+x, y2-y);
					CRT.plot(x2-x, y2-y);
				}
			}
		}
	}
	
	init();
	
	return {
		draw: draw,
		captureRadius: 400
	}
};

// a sun playing Conway's Game of Life

var LifeSun = new function() {
	var r=10, r2=4, maxSteps=20, seedTh=0.35,
	 	size=r+r, max=size-1, steps,
		grid, prevGrid, mask, mask2;
	
	function init() {
		var i, v, x, y, m=r, m1=m-1;
		grid=new Array(size);
		prevGrid=new Array(size);
		mask=new Array(steps);
		mask2=new Array(steps);
		for (i=0; i<size; i++) {
			mask[i]=0;
			mask2[i]=~0;
		}
		for (i=0; i<r; i++) {
			for (x=Math.round(Math.sqrt((r*r)-(i*i))); x>=0; x--) {
				v=(1<<(m-x)) | (1<<(m1+x));
				mask[m1-i]|=v;
				mask[m+i]|=v;
			}
		}
		r=Math.floor(r*0.4);
		for (i=0; i<r2; i++) {
			for (x=Math.round(Math.sqrt((r2*r2)-(i*i))); x>=0; x--) {
				v=(1<<(m-x)) | (1<<(m1+x));
				mask2[m1-i]&=~v;
				mask2[m+i]&=~v;
			}
		}
	}
	
	function reset(keepPrev) {
		var x, y, n, m;
		for (y=0; y<size; y++) {
			n=0;
			m=mask[y];
			for (x=0; x<size; x++) {
				if ((m&(1<<x)) && Math.random()<seedTh) n|=1<<x;
			}
			grid[y]=n;
			if (!keepPrev) prevGrid[y]=0;
		}
		steps=0;
	}
	
	function step() {
		var y, x, n, r, g, xv, xp, xn,
			changed=0, alive=false, newGrid = new Array(size);
		if (steps==maxSteps) reset(true);
		for (y=0; y<size; y++) {
			r=0;
			for (x=0; x<size; x++) {
				n=0;
				xv=1<<x;
				xn=1<<(x+1);
				xp=1<<(x-1);
				if (y>0) {
					g=grid[y-1]&mask[y-1];
					if (x>0 && (g&xp)) n++;
					if (x<max && (g&xn)) n++;
					if (g&xv) n++;
				}
				if (y<max) {
					g=grid[y+1]&mask[y+1];
					if (x>0 && (g&xp)) n++;
					if (x<max && (g&xn)) n++;
					if (g&xv) n++;
				}
				g=grid[y]&mask[y];
				if (x>0 && (g&xp)) n++;
				if (x<max && (g&xn)) n++;
				if (n==3 || ((g&xv) && n==2)) r|=xv;
			}
			if (r!=g && r!=prevGrid[y]) changed++;
			if (r) alive=true;
			newGrid[y]=r;
			prevGrid[y]=g;
		}
		if (changed<3 || !alive) {
			reset(true);
		}
		else {
			grid=newGrid;
			steps++;
		}
	}
	
	function draw() {
		var y, x, px, py, g, gp;
		step();
		for (y=0, py=centerY-size; y<size; y++, py+=2) {
			g=grid[y]&mask2[y];
			gp=prevGrid[y]&mask2[y];
			for (x=0, px=centerX-size; x<size; x++, px+=2) {
				if (g&(1<<x)) {
					CRT.plot(px, py);
				}
				else if ((gp&(1<<x)) && !showTrails) {
					CRT.plot(px, py, 32);
				}
			}
		}
	}
	
	init();
	
	return {
		reset: reset,
		draw: draw,
		captureRadius: 300
	}
};

// configuration utilities

function configureGravity() {
	if (useMITGravity) {
		grav=(lowGravity)? gravity/6:gravity;
	}
	else {
		grav=(lowGravity)? gravity/4:gravity;
	}
	gravTorp=gravity*torpedoMass;
}

function configureSun() {
	sun = (gameOfLifeSun)? LifeSun:(useMITAnimations)? MITSun:MSWSun;
	dimmStars = (gameOfLifeSun || !useMITAnimations);
}
	
function configurePhosphor() {
	CRT.configurePhosphor(bluePhosphor);
	ExpensivePlanetarium.setup(undefined, undefined, undefined, undefined, (bluePhosphor)? starIntensitiesBlue:starIntensities);
	if (gameState==gameStates.splashscreen) displaySplashScreen();
}

function configureTorpedoes() {
	torpMax= (dorpedoesExtdSup)? torpedoesExtdMax:torpedoesMax;
}

function setMITmode(v) {
	MITmode = Boolean(v);
	useMITtorps = MITmode;
	useMITAnimations = MITmode;
	useMITfuel = MITmode;
	useMITOutlines = MITmode;
	useMITHyperspace = MITmode;
	useMITGravity = MITmode;
	useMSWAftertime = !MITmode;
	useRetroThrusters = !MITmode;
	useLifeSun=false;
	configureShips();
}

function setAdvancedSettings(conf) {
	var opts={};
	for (var k in conf) opts[k.toLowerCase()]=Boolean(conf[k]);
	MITmode = (opts.mitoutlines !== undefined)? opts.mitoutlines:MITmode;
	
	useMITtorps =      (opts.mittorpedoes !== undefined)? opts.mittorpedoes:MITmode;
	useMITfuel =       (opts.mitfuel !== undefined)? opts.mitfuel:MITmode;
	useMITAnimations = (opts.mitanimations !== undefined)? opts.mitanimations:MITmode;
	useMITGravity =    (opts.mitgravity !== undefined)? opts.mitgravity:MITmode;
	useMITOutlines =   (opts.mitoutlines !== undefined)? opts.mitoutlines:MITmode;
	useMITHyperspace = !((opts.minnesotahyperspace !== undefined)? opts.minnesotahyperspace:MITmode);
	useMSWAftertime =  (opts.minnesotaaftertime !== undefined)? opts.minnesotaaftertime:MITmode;
	useRetroThrusters = (opts.retrothrusters !== undefined)? opts.retrothrusters:!MITmode;
	useLifeSun=false;
	configureShips();
}

function getAdvancedSettings() {
	return {
		'mittorpedoes': useMITtorps,
		'mitfuel': useMITfuel,
		'mitanimations': useMITAnimations,
		'mitoutlines': useMITOutlines,
		'mitgravity': useMITGravity,
		'minnesotahyperspace': !useMITHyperspace,
		'minnesotaaftertime': useMSWAftertime,
		'retrothrusters': useRetroThrusters
	};
}

function configureShips() {
	shipSetupDx = Math.floor(centerX*0.5);
	shipSetupDy = Math.floor(centerY*0.5);
	shipOutlineOffset = (useMITOutlines)? 2:0;
	shipAccelCf = (useMITGravity)? MITshipAcceleration:MSWshipAcceleration;
	shipDecelCf = shipAccelCf/4;
	fuelMax = (useMITfuel)? MITfuelSupply:MSWfuelSupply;
	torpedoSpeed = (useMITGravity)? MITtorpedoSpeed:MSWtorpedoSpeed;
	torpCooling = (useMITtorps)? MITtorpedoCooling:MSWtorpedoCooling;
	if (useMITtorps && torpedoes && torpedoes.length) {
		for (var i=0, l=torpedoes.length; i<l; i++) {
			var t=torpedoes[i];
			if (t.state>MITtorpedoLifeTime) t.state=MITtorpedoLifeTime;
		}
	}
	if (ships && ships.length) ships[0].hyperCnt=ships[1].hyperCnt=0;
	configureGravity();
	configureSun();
	if (gameState==gameStates.splashscreen) displaySplashScreen();
}

// main

function displaySplashScreen() {
	stop();
	if (gameState) CRT.clear();
	gameState=gameStates.splashscreen;
	var p, x, y=centerY-212, x1=centerX-206, x2=x1+121, a0=255, a1=244, a2=228, a3=255, p1, p2, y1;
	CharGen.write(centerX-159, y, 'MINNESOTA SPACEWAR', 21, 1, a0);
	y+=10;
	drawLine(centerX-268, y, centerX-170, y, false, false, true, 200);
	drawLine(centerX+170, y, centerX+268, y, false, false, true, 200);
	y+=10;
	drawLine(centerX-238, y, centerX-170, y, false, false, true, 200);
	drawLine(centerX+170, y, centerX+238, y, false, false, true, 200);
	p=CharGen.write(x1, y+=52, 'PLAYER 1   MOVEMENT:   '+keyLegends.p1move, 11, 2, a3);
	p=CharGen.write(x2, y+=22, 'FIRE:       ', 11, 2, a2); CharGen.write(p, y, keyLegends.p1fire, 11, 2, a0);
	p=CharGen.write(x2, y+=22, 'HYPERSPACE: ', 11, 2, a2); CharGen.write(p, y, keyLegends.p1hysp, 11, 2, a0);
	p=CharGen.write(x1, y+=44, 'PLAYER 2   MOVEMENT:   '+keyLegends.p2move, 11, 2, a3);
	p=CharGen.write(x2, y+=22, 'FIRE:       ', 11, 2, a2); CharGen.write(p, y, keyLegends.p2fire, 11, 2, a0);
	p=CharGen.write(x2, y+=22, 'HYPERSPACE: ', 11, 2, a2); CharGen.write(p, y, keyLegends.p2hysp, 11, 2, a0);
	CharGen.write(x2, y+=22, 'OR USE THE NUMBER-PAD.', 11, 2, a2);
	
	CharGen.writeCentered(width, y+=54, 'USE BOTH HANDS - SHIPS MAY BE CONTROLLED WHILE INVISIBLE IN HYPERSPACE.', 7, 2, a2);
	CharGen.writeCentered(width, y+=16, 'STANDARD CONTROLS - W,A,S,D & I,J,K,L ONLY - ARE AVAILABLE IN MIT-MODE.', 7, 2, a2);
	
	x=CharGen.writeCentered(width, y+=32, '****************************************************************', 7, 3, a2);
	p=CharGen.write(x, y+=16, '**  ', 7, 3, a2); p=CharGen.write(p, y, 'A HISTORIC COMPUTER GAME FOR TWO HUMAN PLAYERS. ORIGINAL  ', 7, 3, a1); CharGen.write(p, y, '**', 7, 3, a2);
	p=CharGen.write(x, y+=16, '**  ', 7, 3, a2); p=CharGen.write(p, y, 'GAME BY ALBERT W. KUHFELD, 1966-68.  A RECONSTRUCTION BY  ', 7, 3, a1); CharGen.write(p, y, '**', 7, 3, a2);
	p=CharGen.write(x, y+=16, '**  ', 7, 3, a2); p=CharGen.write(p, y, 'N. LANDSTEINER, MASS:WERK - MEDIA ENVIRONMENTS, (C) 2014  ', 7, 3, a1); CharGen.write(p, y, '**', 7, 3, a2);
	CharGen.write(x, y+=16, '****************************************************************', 7, 3, 200);
	p=CharGen.write(x, y+=32, '***********', 7, 4, a2); p=CharGen.write(p, y, '  PRESS ANY KEY TO START THE GAME  ', 7, 4, a1); p=CharGen.write(p, y, '***********', 7, 4, a2);
	CRT.render();
	CRT.updateNow();
	timer = setTimeout(splashLoop, frameDelay);
}

function splashLoop() {
	CRT.flicker();
	timer = setTimeout(splashLoop, frameDelay);
}

function gameStart() {
	stop();
	if (gameState!=gameStates.playing) ExpensivePlanetarium.setup(width, height, 16, 8192/2, (bluePhosphor)? starIntensitiesBlue:starIntensities, plotStars);
	resetTorpedoes();
	resetParticles();
	ships[0].reset();
	ships[1].reset();
	gameCnt= -2;
	LifeSun.reset();
	gameState=gameStates.playing;
	setTimeout(gameLoop, 0);
}

function stop() {
	if (timer) clearTimeout(timer);
	timer=null;
	CRT.resetState();
}

function gameLoop() {
	var d, lastUpdate= (performanceNow)? performance.now() : new Date().getTime();
	if (!paused) {
		if (gameCnt>0) {
			// game ended (waiting for torpedoes, final crashes; on zero do scores or restart)
			if (--gameCnt==0) {
				if (ships[0].state>0) {
					score1++;
				}
				else if (ships[1].state>0) {
					score2++;
				}
				else {
					scoreDraws++;
				}
				if (showScore) {
					displayScores();
				}
				else {
					gameStart();
				}
				return;
			}
		}
		CRT.forceAsyncUpdate();
		if (gameCnt<0) {
			// start count-down
			gameCnt++;
		}
		else {
			// main loop
			var ship0Active = (ships[0].state>0 && !(hyperspaceActive && useMITHyperspace && ships[0].hyperCnt>0 && ships[0].hyperCnt<=MIThyperBreakout)),
				ship1Active = (ships[1].state>0 && !(hyperspaceActive && useMITHyperspace && ships[1].hyperCnt>0 && ships[1].hyperCnt<=MIThyperBreakout)),
				ship0Collidable = (ship0Active || (useMSWAftertime && ships[0].state!=0)),
				ship1Collidable = (ship1Active || (useMSWAftertime && ships[1].state!=0));
			moveTorpedoes();
			if (ship0Active) checkHits(ships[0], torpedoes, true);
			if (ship1Active) checkHits(ships[1], torpedoes, true);
			if (ships[0].state!=0) ships[0].move();
			if (ships[1].state!=0) ships[1].move();
			if (ship0Active) checkHits(ships[0], torpedoes, false);
			if (ship1Active) checkHits(ships[1], torpedoes, false);
			// collisions
			if (ship0Collidable && ship1Collidable && (ship0Active || ship1Active)) {
				var dx=ships[0].x-ships[1].x, dy=ships[0].y-ships[1].y;
				if (dx*dx+dy*dy <= collisionRadius) {
					if (ships[0].state>0) {
						ships[0].scaleVelocity(0.5);
						ships[0].explode();
					}
					if (ships[1].state>0) {
						ships[1].scaleVelocity(0.5);
						ships[1].explode();
					}
				}
			}
			// ships out of fuel & out of torps
			if (ship0Active && ship1Active) {
				if (ships[0].shotsFired>=torpMax && ships[1].shotsFired>=torpMax) {
					// player not in hyperspace wins
					if (hyperspaceActive && !useMITHyperspace && ships[0].hyperspace && !ships[1].hyperspace) {
						ships[0].explode();
					}
					else if (hyperspaceActive && !useMITHyperspace && ships[1].hyperspace && !ships[0].hyperspace) {
						ships[1].explode();
					}
					else {
						ships[0].explode();
						ships[1].explode();
					}
				}
			}
			// handle end of game, start count-down
			if (!gameCnt && (ships[0].state<0 || ships[1].state<0)) gameCnt=
				(showScore && ships[0].state<0 && ships[1].state<0)?
					Math.floor(gameCoolingTime*0.75):
					gameCoolingTime;
		}
		// draw objects
		ships[0].draw();
		ships[1].draw();
		drawTorpedoes();
		if (sunActive) sun.draw();
		if (showStarfield) ExpensivePlanetarium.draw();
		CRT.render();
		CRT.update();
	}
	// re-loop
	d=(performanceNow)?
		frameDelay-Math.round((performance.now()-lastUpdate)):
		frameDelay-(new Date().getTime()-lastUpdate);
	if (d<1) d=1;
	timer = setTimeout(gameLoop, d);
}

function displayScores() {
	var y, x, s1=String(score1), s2=String(score2),
		sd=String(scoreDraws), st=String(score1+score2+scoreDraws),
		pad=Math.max(3, st.length), p='   '; 
	while (p.length<pad) p+=' ';
	if (s1.length<pad) s1=p.substring(0, pad-s1.length)+s1;
	if (s2.length<pad) s2=p.substring(0, pad-s2.length)+s2;
	if (sd.length<pad) sd=p.substring(0, pad-sd.length)+sd;
	if (st.length<pad) st=p.substring(0, pad-st.length)+st;
	scoreStrings.sd=sd;
	scoreStrings.s1=s1;
	scoreStrings.s2=s2;
	scoreStrings.st=st;
	ships[0].reset();
	ships[1].reset();
	ships[0].r=tau*0.75;
	ships[1].r=tau*Math.random();
	ships[0].x=x=centerX-200;
	ships[0].y=y=centerY-105;
	ships[1].x=x;
	ships[1].y=y+100;
	gameState=gameStates.scorer;
	gameCnt=60;
	ships[0].rotate(0);
	ships[1].rotate(0);
	scoreLoop();
}

function scoreLoop() {
	var d, lastUpdate= (performanceNow)? performance.now() : new Date().getTime();
	if (!paused) {
		if (gameCnt) gameCnt--;
		ships[0].drawScaled(2, false);
		ships[1].drawScaled(2, false);
		ships[0].rotate((score1>score2)? 0.75:0.5);
		ships[1].rotate((score2>score1)? 0.75:0.5);
		var x=centerX-100, y=centerY-105-7, x0=centerX-220;
		CharGen.write(x0, y-90, 'SCORES & STATISTICS', 14, 2);
		drawLine(x0, y-72, centerX+220, y-72, false, false, true, 200);
		CharGen.write(x, y,      'SCORE PLAYER 1:  '+scoreStrings.s1, 14, 2);
		CharGen.write(x, y+=100, 'SCORE PLAYER 2:  '+scoreStrings.s2, 14, 2);
		CharGen.write(x, y+= 80, 'DRAWS:           '+scoreStrings.sd, 14, 2);
		CharGen.write(x, y+= 70, 'GAMES TOTAL:     '+scoreStrings.st, 14, 2);
		CharGen.writeCentered(width, y+= 70, '***  PRESS 0 OR ESC TO CLEAR SCORES, ANY OTHER TO CONTINUE  ***', 7, 2);
		CRT.render();
		CRT.update();
	}
	d=(performanceNow)?
		frameDelay-Math.round((performance.now()-lastUpdate)):
		frameDelay-(new Date().getTime()-lastUpdate);
	if (d<1) d=1;
	timer = setTimeout(scoreLoop, d);
}

function gameReset() {
	if (inited) {
		beep();
		scoreDraws=score1=score2=0;
		paused=false;
		displaySplashScreen();
	}
}

// interface

var keyCharMap, keyLegends, keyLang,
	keyMaps = {
		'int': {
			keys: {
				'A': 'P1LFT',
				'D': 'P1RGT',
				'S': 'P1THR',
				'W': 'P1RTR',
				'X': 'P1FIR',
				'Y': 'P1HSP',
				'Z': 'P1HSP',
				'F': 'P1FIR',
				'U+00F1': 'P1FIR',
				'U+00E6': 'P1FIR',
				'R': 'P1HSP',
				'J': 'P2LFT',
				'L': 'P2RGT',
				'K': 'P2THR',
				'I': 'P2RTR',
				'M': 'P2FIR',
				'N': 'P2HSP',
				';': 'P2FIR',
				'\u00ba': 'P2FIR',
				'U+00F6': 'P2FIR',
				'P': 'P2HSP'
			},
			legends: {
				'p1move': 'W  A  S  D',
				'p1fire': 'X OR F',
				'p1hysp': 'Z [Y] OR R',
				'p2move': 'I  J  K  L',
				'p2fire': 'M OR ; [\u00d1,\u00d6,\u00c6]',
				'p2hysp': 'N OR P'
			}
		},
		'fr': {
			keys: {
				'Q': 'P1LFT',
				'D': 'P1RGT',
				'S': 'P1THR',
				'R': 'P1RTR',
				'X': 'P1FIR',
				'W': 'P1HSP',
				'F': 'P1FIR',
				'R': 'P1HSP',
				'J': 'P2LFT',
				'L': 'P2RGT',
				'K': 'P2THR',
				'I': 'P2RTR',
				',': 'P2FIR',
				'\u00bc': 'P2FIR',
				'N': 'P2HSP',
				'M': 'P2FIR',
				'P': 'P2HSP'
			},
			legends: {
				'p1move': 'Z  Q  S  D',
				'p1fire': 'X OU F',
				'p1hysp': 'W OU R',
				'p2move': 'I  J  K  L',
				'p2fire': ', OU M',
				'p2hysp': 'N OU P'
			}
		},
		'dvorak': {
			keys: {
				'A': 'P1LFT',
				'E': 'P1RGT',
				'O': 'P1THR',
				',': 'P1RTR',
				'Q': 'P1FIR',
				'\u00bc': 'P1RTR',
				';': 'P1HSP',
				'\u00ba': 'P1HSP',
				'U': 'P1FIR',
				'P': 'P1HSP',
				'H': 'P2LFT',
				'N': 'P2RGT',
				'T': 'P2THR',
				'C': 'P2RTR',
				'M': 'P2FIR',
				'B': 'P2HSP',
				'S': 'P2FIR',
				'L': 'P2HSP'
			},
			legends: {
				'p1move': ',  A  O  E',
				'p1fire': 'Q OR U',
				'p1hysp': '; OR P',
				'p2move': 'C  H  T  N',
				'p2fire': 'M OR S',
				'p2hysp': 'B OR L'
			}
		}
	},
	keyCodeMap = {// key-pad
		104: 'P2RTR',
		101: 'P2THR',
		102: 'P2RGT',
		100: 'P2LFT',
		110: 'P2FIR',
		96:  'P2HSP',
		98:  'P2FIR',
		97:  'P2HSP'
	};
function setKeyLang(n) {
	if (n!=keyLang && keyMaps[n]) {
		keyCharMap=keyMaps[n].keys;
		keyLegends=keyMaps[n].legends;
		keyLang=n;
		if (gameState==gameStates.splashscreen) displaySplashScreen();
	}
}

function handleKeydown(e) {
	if (e.ctrlKey || e.metaKey) return;
	var c=e.keyCode, ch=String.fromCharCode(c), k=keyCodeMap[c]||keyCharMap[ch];
	if (!c && e.keyIdentifier) {
		ch=e.keyIdentifier;
		if (ch) c=ch.charCodeAt(0);
	}
	switch (gameState) {
		case gameStates.splashscreen:
			gameStart();
			stopEvent(e);
			break;
		case gameStates.playing:
			if (k) {
				setControls(k, true);
			}
			else {
				switch (ch) {
					case ' ':
					case '\b':
						// inhibit accidental scrolling or back-paging
						stopEvent(e);
						break;
				}
			}
			break;
		case gameStates.scorer:
			if (c==27 || c==48) {
				scoreDraws=score1=score2=0;
				beep();
			}
			else if (!gameCnt || !k) {
				beep(0.5);
				gameStart();
			}
			stopEvent(e);
			break;
	}
}

function stopEvent(e) {
	if (e.preventDefault) e.preventDefault();
	if (e.stopPropagation) e.stopPropagation();
}

function handleKeyup(e) {
	if (e.ctrlKey || e.metaKey) return;
	var c=e.keyCode, ch=String.fromCharCode(c), k=keyCodeMap[c]||keyCharMap[ch];
	if (!c && e.keyIdentifier) {
		ch=e.keyIdentifier;
		if (ch) c=ch.charCodeAt(0);
	}
	if (gameState==gameStates.playing && k) setControls(k, false);
}

function setControls(n, v) {
	switch (n) {
		case 'P1LFT': updateTurn(ships[0], true, v); break;
		case 'P1RGT': updateTurn(ships[0], false, v); break;
		case 'P1THR': ships[0].thrust=v; break;
		case 'P1RTR':
			if (useRetroThrusters) {
				ships[0].retro=v;
			}
			else {
				ships[0].fire=v;
			}
			break;
		case 'P1FIR': ships[0].fire=v; break;
		case 'P1HSP': ships[0].hyperspace=v; break;
		case 'P2LFT': updateTurn(ships[1], true, v); break;
		case 'P2RGT': updateTurn(ships[1], false, v); break;
		case 'P2THR': ships[1].thrust=v; break;
		case 'P2RTR':
			if (useRetroThrusters) {
				ships[1].retro=v;
			}
			else {
				ships[1].fire=v;
			}
			break;
		case 'P2FIR': ships[1].fire=v; break;
		case 'P2HSP': ships[1].hyperspace=v; break;
	}
}

function updateTurn(ship, left, v) {
	if (useMITHyperspace && hyperspaceActive) {
		if (left) {
			ship.turnLeft=v;
		}
		else {
			ship.turnRight=v;
		}
		if (ship.turnLeft && ship.turnRight) {
			ship.hyperspace=true;
			ship.turnLeft=ship.turnRight=false;
		}
	}
	else {
		var v0=(left)? ship.turnLeft:ship.turnRight;
		if (left) {
			ship.turnLeft=v;
		}
		else {
			ship.turnRight=v;
		}
		if (v && !v0) {
			if (left) {
				ship.turnRight=false;
			}
			else {
				ship.turnLeft=false
			}
		}
	}
}

function setupControls() {
	setKeyLang('int');
	window.addEventListener('keydown', handleKeydown, false);
	window.addEventListener('keyup', handleKeyup, false);
}


// CRT emulation

var CRT = new function() {
	// (this is basically an "animated" or "painted" display, no memory or auto-refresh.
	// we'll do some bluring and pixelation (by subtracting a darkening raster grid).
	var paintAsync =          true,
		emulateCrtRaster =    false,
		bluePhosphor =        false,
		emulateP7 =           false,
		sustainFadeCf =       0.94,
		sustainFadeCfLong =   0.97,
		sustainCf =           0.5,
		sustainCfLong =       0.68,
		sustainMaxIntensity = 110,
		sustainMinIntensity = 3,
		sustainBlurCf =       0.18,
		sustainFuzzyCf =      0.05,
		crtBlurOrth =         0.45,
		crtBlurDiag =         0.27125,
		crtRasterCf =         0.905,
		staticFlickerCf=      0.045;
	
	var phosphorClrs = [
		[[ 85,194,251], [ 20,156,226]], // blue
		[[209,236,244], [ 94,187,214]]  // whitish
	];
	
	var width, height, maxX, maxY,
		canvas, ctx, canvasData, pixels, pixelStack, pixelVals, pixelIsFresh, clearStack, phosVals,
		sustainBlurMinY, sustainBlurMaxY, sustainBlurMaxN, sustainFade, sustainBlurWeight=sustainBlurCf+1, sustainIntensityCf,
		reqAnimFrame=null, cancelAnimFrame=null, afId=null, frameReady=false,
		clearTOS, pixelTOS, tempStack;
	
	function resolveAnimationFrameAPI() {
		var useAnimationFrameByVendor = {
			general: true,
			webkit: true,
			moz: false, // mozilla's frame rate became just too slow using animation-frames!
			o: true,
			ms: true
		};
		var optOut=false;
		for (var vendor in useAnimationFrameByVendor) {
			var optValue=useAnimationFrameByVendor[vendor];
			if (optValue) {
				reqAnimFrame=window[vendor+'RequestAnimationFrame'];
				if (reqAnimFrame) {
					cancelAnimFrame=window[vendor+'CancelAnimationFrame'] || window[vendor+'CancelRequestAnimationFrame'];
					break;
				}
			}
			else if (optValue === false) {
				optOut=true;
				break;
			}
		}
		if (!optOut && useAnimationFrameByVendor.general && window.requestAnimationFrame) {
			reqAnimFrame=window.requestAnimationFrame;
			cancelAnimFrame=window.cancelAnimationFrame;
		}
	}
	if (paintAsync) resolveAnimationFrameAPI();
	
	function setup(_canvas, _width, _height, _bluePhosphor, _emulateP7) {
		canvas=_canvas;
		width=_width;
		height=_height;
		maxX=width-1;
		maxY=height-1;
		sustainBlurMinY=width;
		sustainBlurMaxY=width*height-width;
		sustainBlurMaxN=width*height-1;
		emulateP7=Boolean(_emulateP7);
		configurePhosphor(_bluePhosphor);
		initDisplay();
	}
	
	function useP7(v) {
		if (v!==undefined) emulateP7=Boolean(v);
		if (bluePhosphor) {
			sustainFade=sustainFadeCfLong;
			sustainIntensityCf=sustainCfLong;
		}
		else {
			sustainFade=sustainFadeCf;
			sustainIntensityCf=sustainCf;
		}
	}
	
	function configurePhosphor(v) {
		bluePhosphor=Boolean(v);
		var clrs = (bluePhosphor)? phosphorClrs[0]:phosphorClrs[1],
			rgb1 = clrs[0],
			rgb2 = clrs[1];
		phosVals=new Array(256);
		for (var i=0; i<256; i++) {
			var c1=i/255, c2=1-c1;
			phosVals[i] = [
				Math.round(rgb1[0]*c1+rgb2[0]*c2),
				Math.round(rgb1[1]*c1+rgb2[1]*c2),
				Math.round(rgb1[2]*c1+rgb2[2]*c2)
			];
		}
		useP7();
	}
	
	function initDisplay() {
		canvas.width = width;
		canvas.height= height;
		ctx = canvas.getContext('2d');
		canvasData=ctx.getImageData(0, 0, width, height);
		pixels=canvasData.data;
		pixelVals=new Array(width*height);
		pixelIsFresh=new Array(width*height);
		pixelStack=[];
		clearStack=[];
		tempStack=[];
		for (var i=0, r=0; r<height; r++) {
			for (var c=0; c<width; c++, i++) {
				pixelVals[i]=0;
				pixelIsFresh[i]=false;
			}
		}
		clearTOS=pixelTOS=0;
	}
	
	function clearDisplay() {
		for (var i=0, j=3, r=0; r<height; r++) {
			for (var c=0; c<width; c++, i++, j+=4) {
				pixelVals[i]=0;
				pixelIsFresh[i]=false;
				pixels[j]=0;
			}
		}
		ctx.putImageData(canvasData, 0, 0);
		clearTOS=pixelTOS=0;
		frameReady=false;
	}
	
	function plot(x, y, a) {
		if (x>maxX) {
			x-=width;
		}
		else if (x<0) {
			x+=width;
		}
		if (y>maxY) {
			y-=height;
		}
		else if (y<0) {
			y+=height;
		}
		upgradePixel(x,y,a||255,3, true, true);
	}

	function upgradePixel(x, y, a, level, rx, ry) {
		if (emulateCrtRaster) {
			if (rx && x%2) a*=crtRasterCf;
			if (ry && y%2) a*=crtRasterCf;
		}
		var i=y*width+x, v=pixelVals[i]
		if (v<a) {
			if (!v) pixelStack[pixelTOS++]=i;
			pixelVals[i]=a;
			pixelIsFresh[i]=true;
			if (--level) {
				var a1=a*crtBlurOrth, a2=a*crtBlurDiag,
					y1=y-1, y2=y+1, x1=x-1, x2=x+1;
				if (y>0) {
					if (x>0) upgradePixel(x1,y1,a2,level);
					if (x2<maxX) upgradePixel(x2,y1,a2,level);
					upgradePixel(x,y1,a1,level);
				}
				if (y2<maxY) {
					if (x>0) upgradePixel(x1,y2,a2,level);
					if (x2<maxX) upgradePixel(x2,y2,a2,level);
					upgradePixel(x,y2,a1,level);
				}
				if (x>0) upgradePixel(x1,y,a1,level);
				if (x2<maxX) upgradePixel(x2,y,a1,level);
			}
		}
	}
	
	function renderBuffer() {
		var s, tos=0, pcf, b, bn;
		if (emulateP7) pcf=sustainFade*(1-0.5*Math.random()*sustainFuzzyCf);
		// clear obsolete pixels
		for (var i=0; i<clearTOS; i++) pixels[(clearStack[i]<<2)+3]=0;
		clearTOS=0;
		s=tempStack;
		// display pixels
		for (var i=0; i<pixelTOS; i++) {
			var n=pixelStack[i], m=n<<2, a=pixelVals[n], p=phosVals[Math.floor(a)];
			for (var k=0; k<3; k++) pixels[m++]=p[k];
			pixels[m]=a;
			if (emulateP7) {
				if (pixelIsFresh[n]) {
					pixelIsFresh[n]=false;
					a=(a*sustainIntensityCf + ((a>sustainMaxIntensity)? sustainMaxIntensity:a))/2;
				}
				else {
					a*=pcf;
					b=bn=0;
					if (n>0) { b+pixelVals[n-1]; bn++; }
					if (n<sustainBlurMaxN) { b+pixelVals[n+1]; bn++; }
					if (n>sustainBlurMinY) { b+pixelVals[n-width]; bn++; }
					if (n<sustainBlurMaxY) { b+pixelVals[n+width]; bn++; }
					if (bn) b/=bn;
					a=(a+b*sustainBlurCf)/sustainBlurWeight;
				}
				if (a>sustainMinIntensity) {
					pixelVals[n]=a;
					s[tos++]=n;
				}
				else {
					pixelVals[n]=0;
					clearStack[clearTOS++]=n;
				}
			}
			else {
				pixelVals[n]=0;
				clearStack[clearTOS++]=n;
			}
		}
		tempStack=pixelStack;
		pixelStack=s;
		pixelTOS=tos;
	}
	
	function updateDisplay() {
		if (reqAnimFrame) {
			frameReady=true;
			if (!afId) updateDisplayAF();
		}
		else {
			ctx.putImageData(canvasData, 0, 0);
			frameReady=false;
		}
	}
	
	function updateDisplayAF() {
		if (frameReady) {
			ctx.putImageData(canvasData, 0, 0);
			frameReady=false;
		}
		afId = reqAnimFrame(updateDisplayAF);
	}
	
	function updateSingleFrame() {
		ctx.putImageData(canvasData, 0, 0);
		frameReady=false;
	}
	
	function forceAsyncUpdate() {
		// force any delayed screen updates
		if (frameReady && reqAnimFrame) {
			ctx.putImageData(canvasData, 0, 0);
			frameReady=false;
		}
	}
	
	function flicker() {
		if (staticFlickerCf) canvas.style.opacity=1-Math.random()*staticFlickerCf;
	}
	
	function resetFlicker() {
		canvas.style.opacity=1;
	}
	
	function resetState() {
		if (afId) cancelAnimFrame(afId);
		afId=null;
		frameReady=false;
		resetFlicker();
	}

	return {
		setup: setup,
		clear: clearDisplay,
		configurePhosphor: configurePhosphor,
		useP7: useP7,
		flicker: flicker,
		resetFlicker: resetFlicker,
		resetState: resetState,
		render: renderBuffer,
		update: updateDisplay,
		updateNow: updateSingleFrame,
		forceAsyncUpdate: forceAsyncUpdate,
		plot: plot,
		plot2: upgradePixel
	};
};

	
function plotStars(x, y, a) {
	if (sunActive && dimmStars) {
		// dimm behind Sun
		var dx=x-centerX, dy=y-centerY, d=dx*dx+dy*dy;
		if (d<=650) {
			if (d<100) return;
			a/=2;
		}
	}
	CRT.plot2(x, y, a, 2, true, false);
}


// a vectorized character generator

var CharGen = (function(drawLine) {
	// requires external function drawLine()
	// font-data: character outlines (triplets: y, x, new path flag)
	var charData = {
		'A': [6,0,1, 2,0,0, 0,2,0, 2,4,0, 6,4,0, 4,0,1, 4,4,0],
		'B': [3,3,1, 4,4,0, 5,4,0, 6,3,0, 6,0,0, 0,0,0, 0,3,0, 1,4,0, 2,4,0, 3,3,0, 3,0,0],
		'C': [1,4,1, 0,3,0, 0,1,0, 1,0,0, 5,0,0, 6,1,0, 6,3,0, 5,4,0],
		'D': [6,0,1, 0,0,0, 0,3,0, 1,4,0, 5,4,0, 6,3,0, 6,0,0],
		'E': [0,4,1, 0,0,0, 6,0,0, 6,4,0, 3,0,1, 3,3,0],
		'F': [0,4,1, 0,0,0, 6,0,0, 3,0,1, 3,3,0],
		'G': [0,4,1, 0,1,0, 1,0,0, 5,0,0, 6,1,0, 6,4,0, 3,4,0, 3,2,0],
		'H': [0,0,1, 6,0,0, 0,4,1, 6,4,0, 3,0,1, 3,4,0],
		'I': [0,2,1, 6,2,0, 0,1,1, 0,3,0, 6,1,1, 6,3,0],
		'J': [0,4,1, 5,4,0, 6,3,0, 6,1,0, 5,0,0],
		'K': [0,0,1, 6,0,0, 0,4,1, 4,0,0, 3,1,1, 6,4,0],
		'L': [0,0,1, 6,0,0, 6,4,0],
		'M': [6,0,1, 0,0,0, 3,2,0, 0,4,0, 6,4,0],
		'N': [6,0,1, 0,0,0, 6,4,0, 0,4,0],
		'O': [1,0,1, 0,1,0, 0,3,0, 1,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0, 1,0,0],
		'P': [6,0,1, 0,0,0, 0,3,0, 1,4,0, 2,4,0, 3,3,0, 3,0,0],
		'Q': [1,0,1, 0,1,0, 0,3,0, 1,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0, 1,0,0, 6,4,1, 4,2,0],
		'R': [6,0,1, 0,0,0, 0,3,0, 1,4,0, 2,4,0, 3,3,0, 3,0,0, 6,4,1, 3,2,0],
		'S': [1,4,1, 0,3,0, 0,1,0, 1,0,0, 2,0,0, 3,1,0, 3,3,0, 4,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0],
		'T': [0,0,1, 0,4,0, 0,2,1, 6,2,0],
		'U': [0,0,1, 5,0,0, 6,1,0, 6,3,0, 5,4,0, 0,4,0],
		'V': [0,0,1, 4,0,0, 6,2,0, 4,4,0, 0,4,0],
		'W': [0,0,1, 6,0,0, 3,2,0, 6,4,0, 0,4,0],
		'X': [0,0,1, 6,4,0, 0,4,1, 6,0,0],
		'Y': [0,0,1, 3,2,0, 0,4,0, 3,2,1, 6,2,0],
		'Z': [0,0,1, 0,4,0, 1,4,0, 5,0,0, 6,0,0, 6,4,0],
		'0': [1,0,1, 0,1,0, 0,3,0, 1,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0, 1,0,0, 1,4,1, 5,0,0],
		'1': [1,1,1, 0,2,0, 6,2,0, 6,1,1, 6,3,0],
		'2': [1,0,1, 0,1,0, 0,3,0, 1,4,0, 2,4,0, 3,3,0, 5,0,0, 6,0,0, 6,4,0],
		'3': [0,0,1, 0,4,0, 2,2,0, 3,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0],
		'4': [6,3,1, 0,3,0, 4,0,0, 4,4,0],
		'5': [0,4,1, 0,0,0, 2,0,0, 2,3,0, 3,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0],
		'6': [1,4,1, 0,3,0, 0,1,0, 1,0,0, 5,0,0, 6,1,0, 6,3,0, 5,4,0, 4,4,0, 3,3,0, 3,0,0],
		'7': [0,0,1, 0,4,0, 1,4,0, 4,2,0, 6,2,0],
		'8': [3,1,1, 2,0,0, 1,0,0, 0,1,0, 0,3,0, 1,4,0, 2,4,0, 3,3,0, 3,1,0, 4,0,0, 5,0,0, 6,1,0, 6,3,0, 5,4,0, 4,4,0, 3,3,0],
		'9': [6,0,1, 6,2,0, 4,4,0, 1,4,0, 0,3,0, 0,1,0, 1,0,0, 2,0,0, 3,1,0, 3,4,0],
		'!': [0,2,1, 4,2,0, 6,2,1, 6,2,0],
		':': [2,2,1, 2,2,0, 5,2,1, 5,2,0],
		',': [4,2,1, 5,2,0, 6,1,0],
		';': [2,2,1, 2,2,0, 4,2,1, 5,2,0, 6,1,0],
		'.': [5,2,1, 5,2,0],
		'"': [0,1,1, 2,1,0, 0,3,1, 2,3,0],
		'\'': [0,2,1, 2,2,0],
		'-': [3,0,1, 3,4,0],
		'+': [1,2,1, 5,2,0, 3,0,1, 3,4,0],
		'=': [2,0,1, 2,4,0, 4,0,1, 4,4,0],
		'*': [1,0,1, 4,4,0, 1,4,1, 4,0,0, 0,2,1, 5,2,0],
		'/': [0,4,1, 6,0,0],
		'\\': [0,0,1, 6,4,0],
		'#': [0,1,1, 6,0,0, 0,4,1, 6,3,0, 2,0,1, 2,4,0, 4,0,1, 4,4,0],
		'%': [0,0,1, 0,1,0, 2,1,0, 2,0,0, 0,0,0, 6,4,1, 6,3,0, 4,3,0, 4,4,0, 6,4,0, 0,4,1, 6,0,0],
		']': [0,2,1, 0,3,0, 6,3,0, 6,2,0],
		'[': [0,2,1, 0,1,0, 6,1,0, 6,2,0],
		')': [0,1,1, 2,3,0, 4,3,0, 6,1,0],
		'(': [0,3,1, 2,1,0, 4,1,0, 6,3,0],
		'}': [0,1,1, 1,2,0, 2,2,0, 3,3,0, 4,2,0, 5,2,0, 6,1,0],
		'{': [0,3,1, 1,2,0, 2,2,0, 3,1,0, 4,2,0, 5,2,0, 6,3,0],
		'>': [1,1,1, 3,4,0, 5,1,0],
		'<': [1,3,1, 3,0,0, 5,3,0],
		'?': [1,0,1, 0,1,0, 0,3,0, 1,4,0, 2,4,0, 3,2,0, 4,2,0, 5,2,1, 6,2,0],
		'@': [6,4,1, 6,1,0, 5,0,0, 1,0,0, 0,1,0, 0,3,0, 1,4,0, 5,4,0, 5,3,0, 2,3,0, 2,1,0, 5,1,0, 5,3,0],
		'&': [6,4,1, 1,0,0, 1,0,0, 0,1,0, 0,2,0, 1,3,0, 1,3,0, 4,0,0, 5,0,0, 6,1,0, 6,3,0, 4,4,0],
		'|': [0,2,1, 6,2,0],
		'_': [6,0,1, 6,4,0],
		'^': [2, 1, 0, 0,2,0, 2,3,0],
		'~': [3,0,1, 2,1,0, 4,3,0, 3,4,0],
		'©': [2,-1,1, 0,1,0, 0,3,0, 2,5,0, 4,5,0, 6,3,0, 6,1,0, 4,-1,0, 2,-1,0, 1,3,0, 2,1,0, 4,1,0, 4,3,0],
		'\u00d1': [6,0,1, 2,0,0, 6,4,0, 2,4,0, 0,1,1, 0,2,0, 1,2,0, 0,4,0],
		'\u00d6': [3,0,1, 2,1,0, 2,3,0, 3,4,0, 5,4,0, 6,3,0, 6,1,0, 5,0,0, 3,0,0, 0,1,1, 0,1,0, 0,3,1, 0,3,0],
		'\u00c6': [6,0,1, 1,0,0, 0,1,0, 0,4,0, 0,2,0, 6,2,0, 6,4,0, 3,0,1, 3,4,0],
		' ': []
	};

	function write(x, y, text, size, padding, a) {
		if (!size) size=10;
		if (!padding) padding=1;
		size/=7;
		var w=(5+padding)*size, penUp, lx, ly,cx, cy, v;
		var midY=size*3.5, midX=size*2.5;
		for (var i=0, l=text.length; i<l; i++) {
			var c=charData[text.charAt(i)];
			if (c==' ') {
				x+=w;
			}
			else {
				if (!c) c=charData['?'];
				for (var k=0, mk=c.length; k<mk; k+=3) {
					penUp=Boolean(c[k+2]);
					if (penUp) {
						v=c[k+1]*size;
						lx=(v>midX)? Math.round(x+v): Math.floor(x+v);
						v=c[k]*size;
						ly=(v>midY)? Math.round(y+v): Math.floor(y+v);
					}
					else {
						v=c[k+1]*size;
						cx=(v>midX)? Math.round(x+v): Math.floor(x+v);
						v=c[k]*size;
						cy=(v>midY)? Math.round(y+v): Math.floor(y+v);
						drawLine(lx, ly, cx, cy, false, false, false, a);
						lx=cx;
						ly=cy;
					}
				}
				x+=w;
			}
		}
		return x;
	}
	
	function getTextWidth(length, size, padding) {
		if (!size) size=10;
		if (!padding) padding=1;
		return (length*5+(length-1)*padding)*size/7;
	}
	
	function writeCentered(width, y, text, size, padding, a) {
		var x=Math.floor((width-getTextWidth(text.length, size, padding))/2);
		write(x, y, text, size, padding, a);
		return x;
	}
	
	return {
		write: write,
		writeCentered: writeCentered,
		getTextWidth: getTextWidth
	};
})(drawLine);

var ExpensivePlanetarium = new function() {
	// original EP by Peter Samson (prs) for Spacewar! 2b, 1962
	// this implementation N.Landsteiner, 2014
	// calls external plot-function (x, y, b);
	// setup data giving original values (to be overwritten by setup)
	var width=1204, height=1024,
		step=16, r=0, cnt=0,
		b1=3, b2=2, b3=1, b4=0,
		scale = height/1024,
		ratio=width/height,
		datawidth = Math.floor(1024*ratio-1),
		plot=function(x,y,b) {};

	function setup(_width, _height, _stepWidth, _initialStep, _brightnesses, _plotFunc) {
		if (!isNaN(_width)) width=_width;
		if (!isNaN(_height)) height=_height;
		if (!isNaN(_stepWidth)) step=_stepWidth;
		if (!isNaN(_initialStep)) r=_initialStep%8192;
		if (_brightnesses && Object.prototype.toString.call(_brightnesses)=='[object Array]' && _brightnesses.length>=4) {
			b1=_brightnesses[0];
			b2=_brightnesses[1];
			b3=_brightnesses[2];
			b4=_brightnesses[3];
		}
		if (typeof _plotFunc == 'function') plot=_plotFunc;
		scale = height/1024;
		ratio=width/height;
		datawidth = Math.floor(1024*ratio-1);
	}

	function reset() {
		cnt=r=0;
	}

	function dislis(j, q, b) {
		var l=r+datawidth, i=0;
		for (;;) {
			var sx=j[i++];
			var sy=j[i++];
			if (sx>=l) break;
			if (sx>=r) {
				plot(width-Math.round((sx-r)*scale)-1, Math.floor((512-sy)*scale), b);
			}
			if (i==q) {
				i=0;
				r=0;
				l=r-datawidth;
			}
		}
	}

	function draw() {
		if (++cnt==step) {
			r++;
			if (r==8192) r=0;
			cnt=0;
		}
		dislis(stars['1j'], stars['1j'].length, b1);
		dislis(stars['2j'], stars['2j'].length, b2);
		dislis(stars['3j'], stars['3j'].length, b3);
		dislis(stars['4j'], stars['4j'].length, b4);
	}

var stars = {
	// stars by prs 3/13/62 for s/w 2b
	// order: x, y (ascending by y)
	// x-range: 0 .. 8192
	// y-range: -512 .. +512
'1j': [	// intensity: 3 (brightest)
	1537, 371,	//87 Taur, Aldebaran
	1762, -189,	//19 Orio, Rigel
	1990, 168,	//58 Orio, Betelgeuze
	2280, -377,	//9 CMaj, Sirius
	2583, 125,	//10 CMin, Procyon
	3431, 283,	//32 Leon, Regulus
	4551, -242,	//67 Virg, Spica
	4842, 448,	//16 Boot, Arcturus
	6747, 196	//53 Aqil, Altair
],
'2j': [	// intensity: 2
	1819, 143,	//24 Orio, Bellatrix
	1884, -29,	//46 Orio
	1910, -46,	//50 Orio
	1951, -221,	//53 Orio
	2152, -407,	// 2 CMaj
	2230, 375,	//24 Gemi
	3201, -187,	//30 Hyda, Alphard
	4005, 344,	//94 Leon, Denebola
	5975, 288	//55 Ophi
],
'3j': [	// intensity: 1
	46, 333,	//88 Pegs, Algenib
	362, -244,	//31 Ceti
	490, 338,	//99 Pisc
	566, -375,	//52 Ceti
	621, 462,	// 6 Arie
	764, -78,	//68 Ceti, Mira
	900, 64,	//86 Ceti
	1007, 84,	//92 Ceti
	1243, -230,	//23 Erid
	1328, -314,	//34 Erid
	1495, 432,	//74 Taur
	1496, 356,	//78 Taur
	1618, 154,	// 1 Orio
	1644, 52,	// 8 Orio
	1723, -119,	//67 Erid
	1755, -371,	// 5 Leps
	1779, -158,	//20 Orio
	1817, -57,	//28 Orio
	1843, -474,	// 9 Leps
	1860, -8,	//34 Orio
	1868, -407,	//11 Leps
	1875, 225,	//39 Orio
	1880, -136,	//44 Orio
	1887, 480,	//123 Taur
	1948, -338,	//14 Leps
	2274, 296,	//31 Gemi
	2460, 380,	//54 Gemi
    2470, 504,	//55 Gemi
	2513, 193,	// 3 CMin
	2967, 154,	//11 Hyda
	3016, 144,	//16 Hyda
	3424, 393,	//30 Leon
	3496, 463,	//41 Leon, Algieba
	3668, -357,	//nu Hyda
	3805, 479,	//68 Leon
	3806, 364,	//10 Leon
	4124, -502,	// 2 Corv
	4157, -387,	// 4 Corv
	4236, -363,	// 7 Corv
	4304, -21,	//29 Virg
	4384, 90,	//43 Virg
	4421, 262,	//47 Virg
	4606, -2,	//79 Virg
	4721, 430,	// 8 Boot
	5037, -356,	// 9 Libr
	5186, -205,	//27 Libr
	5344, 153,	//24 Serp
	5357, 358,	//28 Serp
	5373, -71,	//32 Serp
	5430, -508,	// 7 Scor
	5459, -445,	// 8 Scor
	5513, -78,	// 1 Ophi
	5536, -101,	// 2 Ophi
	5609, 494,	//27 Herc
	5641, -236,	//13 Ophi
	5828, -355,	//35 Ophi
	5860, 330,	//64 Herc
	5984, -349,	//55 Serp
	6047, 63,	//62 Ophi
	6107, -222,	//64 Ophi
	6159, 217,	//72 Ophi
	6236, -66,	//58 Serp
	6439, -483,	//37 Sgtr
	6490, 312,	//17 Aqil
	6491, -115,	//16 Aqil
	6507, -482,	//41 Sgtr
	6602, 66,	//30 Aqil
	6721, 236,	//50 Aqil
	6794, 437,	//12 Sgte
	6862, -25,	//65 Aqil
	6914, -344,	// 9 Capr
	7014, 324,	// 6 Dlph
	7318, -137,	//22 Aqar
	7391, 214,	// 8 Pegs
	7404, -377,	//49 Capr
	7513, -18,	//34 Aqar
	7539, 130,	//26 Pegs
	7644, -12,	//55 Aqar
	7717, 235,	//42 Pegs
	7790, -372,	//76 Aqar
	7849, 334	//54 Pegs, Markab
],
'4j': [	// intensity: 0 (dimmest)
	1, -143,	//33 Pisc
	54, 447,	//89 Pegs
	54, -443,	// 7 Ceti
	82, -214,	// 8 Ceti
	223, -254,	//17 Ceti
	248, 160,	//63 Pisc
	273, -38,	//20 Ceti
	329, 167,	//71 Pisc
	376, 467,	//84 Pisc
	450, -198,	//45 Ceti
	548, 113,	//106 Pisc
	570, 197,	//110 Pisc
	595, -255,	//53 Ceti
	606, -247,	//55 Ceti
	615, 428,	// 5 Arie
	617, 61,	//14 Pisc
	656, -491,	//59 Ceti
	665, 52,	//113 Pisc
	727, 191,	//65 Ceti
	803, -290,	//72 Ceti
	813, 182,	//73 Ceti
	838, -357,	//76 Ceti
	878, -2,	//82 Ceti
	907, -340,	//89 Ceti
	908, 221,	//87 Ceti
	913, -432,	// 1 Erid
	947, -487,	// 2 Erid
	976, -212,	// 3 Erid
	992, 194,	//91 Ceti
	1058, 440,	//57 Arie
	1076, 470,	//58 Arie
	1087, -209,	//13 Erid
	1104, 68,	//96 Ceti
	1110, -503,	//16 Erid
	1135, 198,	// 1 Taur
	1148, 214,	// 2 Taur
	1168, 287,	// 5 Taur
	1170, -123,	//17 Erid
	1185, -223,	//18 Erid
	1191, -500,	//19 Erid
	1205, 2,	//10 Taur
	1260, -283,	//26 Erid
	1304, -74,	//32 Erid
	1338, 278,	//35 Taur
	1353, 130,	//38 Taur
	1358, 497,	//37 Taur
	1405, -162,	//38 Erid
	1414, 205,	//47 Taur
	1423, 197,	//49 Taur
	1426, -178,	//40 Erid
	1430, 463,	//50 Taur
	1446, 350,	//54 Taur
	1463, 394,	//61 Taur
	1470, 392,	//64 Taur
	1476, 502,	//65 Taur
	1477, 403,	//68 Taur
    1483, 350,	//71 Taur
	1485, 330,	//73 Taur
	1495, 358,	//77 Taur
	1507, 364,	//
	1518, -6,	//45 Erid
	1526, 333,	//86 Taur
	1537, 226,	//88 Taur
	1544, -81,	//48 Erid
	1551, 280,	//90 Taur
	1556, 358,	//92 Taur
	1557, -330,	//53 Erid
	1571, -452,	//54 Erid
	1596, -78,	//57 Erid
	1622, 199,	// 2 Orio
	1626, 124,	// 3 Orio
	1638, -128,	//61 Erid
	1646, 228,	// 7 Orio
	1654, 304,	// 9 Orio
	1669, 36,	//10 Orio
	1680, -289,	//64 Erid
	1687, -167,	//65 Erid
	1690, -460,	//
	1690, 488,	//102 Taur
	1700, 347,	//11 Orio
	1729, 352,	//15 Orio
	1732, -202,	//69 Erid
	1750, -273,	// 3 Leps
	1753, 63,	//17 Orio
	1756, -297,	// 4 Leps
	1792, -302,	// 6 Leps
	1799, -486,	//
	1801, -11,	//22 Orio
	1807, 79,	//23 Orio
	1816, -180,	//29 Orio
	1818, 40,	//25 Orio
	1830, 497,	//114 Taur
	1830, 69,	//30 Orio
	1851, 134,	//32 Orio
	1857, 421,	//119 Taur
	1861, -168,	//36 Orio
	1874, 214,	//37 Orio
	1878, -138,	//
	1880, -112,	//42 Orio
	1885, 210,	//40 Orio
	1899, -60,	//48 Orio
	1900, 93,	//47 Orio
	1900, -165,	//49 Orio
	1909, 375,	//126 Taur
	1936, -511,	//13 Leps
	1957, 287,	//134 Taur
	1974, -475,	//15 Leps
	1982, 461,	//54 Orio
	2002, -323,	//16 Leps
	2020, -70,	//
	2030, 220,	//61 Orio
    2032, -241,	// 3 Mono
	2037, 458,	//62 Orio
	2057, -340,	//18 Leps
	2059, 336,	//67 Orio
	2084, 368,	//69 Orio
	2084, 324,	//70 Orio
	2105, -142,	// 5 Mono
	2112, -311,	//
	2153, 106,	// 8 Mono
	2179, 462,	//18 Gemi
	2179, -107,	//10 Mono
	2184, -159,	//11 Mono
	2204, 168,	//13 Mono
	2232, -436,	// 7 CMaj
	2239, -413,	// 8 CMaj
	2245, -320,	//
	2250, 227,	//15 Mono
	2266, 303,	//30 Gemi
	2291, 57,	//18 Mono
	2327, 303,	//38 Gemi
	2328, -457,	//15 CMaj
	2330, -271,	//14 CMaj
	2340, -456,	//19 CMaj
	2342, -385,	//20 CMaj
	2378, -93,	//19 Mono
	2379, 471,	//43 Gemi
	2385, -352,	//23 CMaj
	2428, -8,	//22 Mono
	2491, -429,	//
	2519, 208,	// 4 CMin
	2527, 278,	// 6 CMin
	2559, -503,	//
	2597, -212,	//26 Mono
	2704, -412,	//
	2709, -25,	//28 Mono
	2714, 60,	//
	2751, -61,	//29 Mono
	2757, -431,	//16 Pupp
	2768, -288,	//19 Pupp
	2794, 216,	//17 Canc
	2848, -82,	//
	2915, 138,	// 4 Hyda
	2921, 84,	// 5 Hyda
	2942, -355,	// 9 Hyda
	2944, 497,	//43 Canc
	2947, 85,	// 7 Hyda
	2951, -156,	//
	2953, 421,	//47 Canc
	2968, -300,	//12 Hyda
	2976, 141,	//13 Hyda
	3032, 279,	//65 Canc
	3124, 62,	//22 Hyda
	3157, -263,	//26 Hyda
	3161, -208,	//27 Hyda
	3209, -53,	//31 Hyda
	3225, -17,	//32 Hyda
	3261, 116,	//
    3270, -16,	//35 Hyda
	3274, -316,	//38 Hyda
	3276, 236,	//14 Leon
	3338, -327,	//39 Hyda
	3385, 194,	//29 Leon
	3415, -286,	//40 Hyda
	3428, 239,	//31 Leon
	3429, 3,	//15 Sext
	3446, -270,	//41 Hyda
	3495, 455,	//40 Leon
	3534, -372,	//42 Hyda
	3557, -3,	//30 Sext
	3570, 223,	//47 Leon
	3726, -404,	//al Crat
	3736, -44,	//61 Leon
	3738, 471,	//60 Leon
	3754, 179,	//63 Leon
	3793, -507,	//11 Crat
	3821, -71,	//74 Leon
	3836, -324,	//12 Crat
	3846, 150,	//77 Leon
	3861, 252,	//78 Leon
	3868, -390,	//15 Crat
	3935, -211,	//21 Crat
	3936, -6,	//91 Leon
	3981, -405,	//27 Crat
	3986, 161,	// 3 Virg
	3998, 473,	//93 Leon
	4013, 53,	// 5 Virg
	4072, 163,	// 8 Virg
	4097, 211,	// 9 Virg
	4180, -3,	//15 Virg
	4185, 418,	//11 Coma
	4249, -356,	// 8 Corv
	4290, -170,	//26 Virg
	4305, 245,	//30 Virg
	4376, -205,	//40 Virg
	4403, 409,	//36 Coma
	4465, -114,	//51 Virg
	4466, 411,	//42 Coma
	4512, -404,	//61 Virg
	4563, -352,	//69 Virg
	4590, -131,	//74 Virg
	4603, 95,	//78 Virg
	4679, 409,	// 4 Boot
	4691, 371,	// 5 Boot
	4759, 46,	//93 Virg
	4820, 66,	//
	4822, -223,	//98 Virg
	4840, -126,	//99 Virg
	4857, -294,	//100 Virg
	4864, 382,	//20 Boot
	4910, -41,	//105 Virg
	4984, 383,	//29 Boot
	4986, 322,	//30 Boot
	4994, -119,	//107 Virg
    5009, 396,	//35 Boot
	5013, 53,	//109 Virg
	5045, 444,	//37 Boot
	5074, -90,	//16 Libr
	5108, 57,	//110 Virg
	5157, -442,	//24 Libr
	5283, -221,	//37 Libr
	5290, -329,	//38 Libr
	5291, 247,	//13 Serp
	5326, -440,	//43 Libr
	5331, 455,	//21 Serp
	5357, 175,	//27 Serp
	5372, 420,	//35 Serp
	5381, 109,	//37 Serp
	5387, 484,	//38 Serp
	5394, -374,	//46 Libr
	5415, 364,	//41 Serp
	5419, -318,	//48 Libr
	5455, -253,	//xi Scor
	5467, -464,	// 9 Scor
	5470, -469,	//10 Scor
	5497, -437,	//14 Scor
	5499, -223,	//15 Scor
	5558, 29,	//50 Serp
	5561, 441,	//20 Herc
	5565, -451,	// 4 Ophi
	5580, 325,	//24 Herc
	5582, -415,	// 7 Ophi
	5589, -186,	// 3 Ophi
	5606, -373,	// 8 Ophi
	5609, 50,	//10 Ophi
	5610, -484,	// 9 Ophi
	5620, 266,	//29 Herc
	5713, -241,	//20 Ophi
	5742, 235,	//25 Ophi
	5763, 217,	//27 Ophi
	5807, 293,	//60 Herc
	5868, -8,	//41 Ophi
	5888, -478,	//40 Ophi
	5889, -290,	//53 Serp
	5924, -114,	//
	5925, 96,	//49 Ophi
	5987, -183,	//57 Ophi
	6006, -292,	//56 Serp
	6016, -492,	//58 Ophi
	6117, -84,	//57 Serp
	6117, 99,	//66 Ophi
	6119, 381,	//93 Herc
	6119, 67,	//67 Ophi
	6125, 30,	//68 Ophi
	6146, 57,	//70 Ophi
	6158, 198,	//71 Ophi
	6170, 473,	//102 Herc
	6188, -480,	//13 Sgtr
	6234, 76,	//74 Ophi
	6235, 499,	//106 Herc
    6247, -204,	//xi Scut
	6254, -469,	//21 Sgtr
	6255, 494,	//109 Herc
	6278, -333,	//ga Scut
	6313, -189,	//al Scut
	6379, 465,	//110 Herc
	6382, -110,	//be Scut
	6386, 411,	//111 Herc
	6436, 93,	//63 Serp
	6457, 340,	//13 Aqil
	6465, -134,	//12 Aqil
	6478, -498,	//39 Sgtr
	6553, 483,	// 1 Vulp
	6576, -410,	//44 Sgtr
	6576, -368,	//46 Sgtr
	6607, 3,	//32 Aqil
	6651, 163,	//38 Aqil
	6657, 445,	// 9 Vulp
	6665, -35,	//41 Aqil
	6688, 405,	// 5 Sgte
	6693, 393,	// 6 Sgte
	6730, 416,	// 7 Sgte
	6739, 430,	// 8 Sgte
	6755, 17,	//55 Aqil
	6766, 187,	//59 Aqil
	6772, 140,	//60 Aqil
	6882, 339,	//67 Aqil
	6896, -292,	// 5 Capr
	6898, -292,	// 6 Capr
	6913, -297,	// 8 Capr
	6958, -413,	//11 Capr
	6988, 250,	// 2 Dlph
	7001, 326,	// 4 Dlph
	7015, -33,	//71 Aqil
	7020, 475,	//29 Vulp
	7026, 354,	// 9 Dlph
	7047, 335,	//11 Dlph
	7066, 359,	//12 Dlph
	7067, -225,	// 2 Aqar
	7068, -123,	// 3 Aqar
	7096, -213,	// 6 Aqar
	7161, -461,	//22 Capr
	7170, -401,	//23 Capr
	7192, -268,	//13 Aqar
	7199, 222,	// 5 Equl
	7223, 219,	// 7 Equl
	7230, 110,	// 8 Equl
	7263, -393,	//32 Capr
	7267, 441,	// 1 Pegs
	7299, -506,	//36 Capr
	7347, -453,	//39 Capr
	7353, -189,	//23 Aqar
	7365, -390,	//40 Capr
	7379, -440,	//43 Capr
	7394, 384,	// 9 Pegs
	7499, -60,	//31 Aqar
	7513, 104,	//22 Pegs
    7515, -327,	//33 Aqar
	7575, -189,	//43 Aqar
	7603, -43,	//48 Aqar
	7604, 266,	//31 Pegs
	7624, 20,	//52 Aqar
	7639, 96,	//35 Pegs
	7654, -255,	//57 Aqar
	7681, -14,	//62 Aqar
	7727, -440,	//66 Aqar
	7747, 266,	//46 Pegs
	7761, -321,	//71 Aqar
	7779, -185,	//73 Aqar
	7795, 189,	//50 Pegs
	7844, 75,	// 4 Pisc
	7862, 202,	//55 Pegs
	7874, -494,	//88 Aqar
	7903, -150,	//90 Aqar
	7911, -219,	//91 Aqar
	7919, 62,	// 6 Pisc
	7923, -222,	//93 Aqar
	7952, -470,	//98 Aqar
	7969, -482,	//99 Aqar
	7975, 16,	// 8 Pisc
	7981, 133,	//10 Pisc
	7988, 278,	//70 Pegs
	8010, -489,	//101 Aqar
	8049, 116,	//17 Pisc
	8059, -418,	//104 Aqar
	8061, 28,	//18 Pisc
	8064, -344,	//105 Aqar
	8159, 144,	//28 Pisc
	8174, -149,	//30 Pisc
	8188, -407	// 2 Ceti
]
};
	// end of stars
	return {
		setup: setup,
		reset: reset,
		draw: draw
	};
};

// sound

var SoundManager = new function() {
	var type, sounds=new Object(), volume=0.75, audioAPI=null, canPlay=false, startFromCallback=false,
		masterGain, ctx, buffers={},
		soundData = ['beep'];
	function setup() {
		if (!window.AudioContext) {
			var vendors=['webkit', 'moz', 'o', 'ms'];
			for (var i=0; i<vendors.length; i++) {
				var api=window[vendors[i]+'AudioContext'];
				if (api) {
					audioAPI=api;
					break;
				}
			}
		}
		var a=document.createElement('audio');
		if (!a || !a.canPlayType) return;
		if (a.canPlayType('audio/mpeg')!='') {
			type='.mp3';
		}
		else if (a.canPlayType('audio/wav')!='' || a.canPlayType('audio/x-wav')!='') {
			type='.wav';
		}
		else if (a.canPlayType('audio/ogg')!='') {
			type='.ogg';
		}
		if (!type) return;
		canPlay=true;
		if (audioAPI) {
			if (typeof navigator !== 'undefined' && navigator.userAgent) {
				if (navigator.userAgent.indexOf('Chrome')!==-1) {
					if (parseInt(navigator.userAgent.replace(/^.*?\bChrome\/([0-9]+).*$/, '$1'),10)>=32) {
						startFromCallback=true;
					}
				}
				else if (navigator.userAgent.match(/\bVersion\/[0-9]+\.[0-9\.]+ (Mobile\/\w+ )?Safari\//)) {
					if (parseInt(navigator.userAgent.replace(/^.*?\bVersion\/([0-9]+).*$/, '$1'),10)>=9) {
						startFromCallback=true;
					}
				}
			}
			ctx=new audioAPI();
			if (ctx.createGain) {
				masterGain=ctx.createGain();
			}
			else {
				masterGain=ctx.createGainNode();
			}
			masterGain.gain.value=volume;
			masterGain.connect(ctx.destination);
		}
		load(soundData);
	}
	function load(soundlist) {
		if (!canPlay) return;
		if (audioAPI) {
			for (var i=0; i<soundlist.length; i++) loadSound(soundlist[i]);
		}
		else {
			for (var i=0; i<soundlist.length; i++) {
				var sname=soundlist[i],
					a=document.createElement('audio');
				a.setAttribute('preload', 'auto');
				a.setAttribute('autobuffer', 'autobuffer');
				a.setAttribute('src', 'sounds/'+sname+type);
				buffers[sname]=a;
				a.load();
				a.volume=volume;
			}
		}
	}
	function loadSound(sname) {
		try {
			var request = new XMLHttpRequest();
			request.open('GET', 'sounds/'+sname+type, true);
			request.responseType = 'arraybuffer';
			request.onload = (startFromCallback)?
				function() {
					buffers[sname] = request.response;
				} : function() {
				ctx.decodeAudioData(request.response, function(data) {
					buffers[sname] = data;
				});
			}
			request.send();
		}
		catch (e) {}
	}
	function play(n, v) {
		if (!canPlay || !buffers[n]) return;
		if (audioAPI) {
			var source = ctx.createBufferSource();
			if (v) {
				var gainNode;
				if (ctx.createGain) {
					gainNode=ctx.createGain();
				}
				else {
					gainNode=ctx.createGainNode();
				}
				source.connect(gainNode);
				gainNode.connect(masterGain);
				gainNode.gain.value=v;
			}
			else {
				source.connect(masterGain);
			}
			if (startFromCallback) {
				ctx.decodeAudioData(buffers[n], function(buffer) {
					source.buffer = buffer;
					if (source.start) {
						source.start(0);
					}
					else {
						source.noteOn(0);
					}
				});
			}
			else {
				source.buffer = buffers[n];
				if (source.start) {
					source.start(0);
				}
				else {
					source.noteOn(0);
				}
			}
		}
		else {
			var a=buffers[n];
			if (v) a.volume=Math.min(1, volume*v);
			a.play();
		}
	}
	function setVolume(v) {
		if (!canPlay) return;
		if (v!=volume) {
			volume=v;
			if (audioAPI) masterGain.gain.value=volume;
		}
	}
	setup();
	return {
		play: play,
		setVolume: setVolume,
		load: load
	}
}
function beep(v) {
	SoundManager.play('beep', (v)? v*0.5:0.5);
}
function playSound(n, v) {
	SoundManager.play(n, v);
}
function loadSounds(soundlist) {
	SoundManager.load(soundlist);
}

// setup and init

function setup() {
	if (inited) return;
	var canvas=document.getElementById(canvasId);
	if (!canvas || !canvas.getContext || !window.addEventListener) {
		alert('Sorry, not compatible.\nStandards-compliant browsers only.');
		return;
	}
	CRT.setup(canvas, width, height, bluePhosphor, showTrails);
	setMITmode(MITmode);
	configureTorpedoes();
	scoreDraws=score1=score2=0;
	ships=[new Ship(0), new Ship(1)];
	setupControls();
	inited=true;
	displaySplashScreen();
}

function init() {
	window.addEventListener('load', setup, false);
}
init();

// external API

function setSwitch(n, value) {
	var v=Boolean(value);
	switch (n.toLowerCase()) {
		case 'salvoes': salvoes=v; break;
		case 'lowgravity': lowGravity=v; configureGravity(); break;
		case 'sunkills': sunKills=v; break;
		case 'sunoff': sunActive=!v; break;
		case 'gameoflifesun': gameOfLifeSun=v; configureSun(); break;
		case 'partialdamage': partialDamage=v; break;
		case 'torpedogravity': torpedoGravity=v; break;
		case 'dorpedoextdsupply': dorpedoesExtdSup=v; configureTorpedoes(); break;
		case 'hyperspaceactive': hyperspaceActive=v; break;
		case 'mitmode': setMITmode(v); break;
		case 'showscore': showScore=v; break;
		case 'showstarfield': showStarfield=v; break;
		case 'showtrails': showTrails=v; CRT.useP7(v); break;
		case 'bluephosphor': bluePhosphor=v; configurePhosphor(); break;
		case 'fuzzytorpedoes': fuzzyTorpedoes=v; break;
	}
}
function getSwitch(n) {
	switch (n.toLowerCase()) {
		case 'salvoes': return salvoes;
		case 'lowgravity': return lowGravity;
		case 'sunkills': return sunKills;
		case 'sunoff': return !sunActive;
		case 'gameoflifesun': return gameOfLifeSun;
		case 'partialdamage': return partialDamage;
		case 'torpedogravity': return torpedoGravity; break;
		case 'dorpedoextdsupply': return dorpedoesExtdSup;
		case 'hyperspaceactive': return hyperspaceActive;
		case 'mitmode': return MITmode;
		case 'showscore': return showScore;
		case 'showstarfield': return showStarfield;
		case 'showtrails': return showTrails; break;
		case 'bluephosphor': return bluePhosphor; break;
		case 'fuzzytorpedoes': return fuzzyTorpedoes; break;
	}
	return undefined;
}
function setControlsExternal(n,v) {
	if (gameState==gameStates.playing) {
		setControls(n, Boolean(v));
	}
	else if (gameState==gameStates.splashscreen || (gameState==gameStates.scorer && !gameCnt)) {
		gameStart();
	}
}
function pause(v) {
	paused=Boolean(v);
}

return {
	setSwitch: setSwitch,
	getSwitch: getSwitch,
	setControls: setControlsExternal,
	reset: gameReset,
	setKeyLang: setKeyLang,
	loadSounds: loadSounds,
	playSound: playSound,
	beep: beep,
	setAdvancedSettings: setAdvancedSettings,
	getAdvancedSettings: getAdvancedSettings,
	pause: pause
};

};


// UI stuff for switches and their handlers

var minnesotaSpacewarUI = new function() {
	var switches = ['salvoes', 'lowgravity', 'sunkills', 'gameoflifesun', 'partialdamage', 'torpedogravity', 'dorpedoextdsupply', 'showscore', 'showstarfield', 'hyperspaceactive', 'fuzzytorpedoes'], actions=switches.concat(['mitmode','showtrails', 'bluephosphor']), active=false;;
	function uiSetup() {
		var canvas=document.getElementById('spacewarCanvas');
		if (!canvas || !canvas.getContext) return;
		active=true;
		for (var i=0; i<actions.length; i++) {
			var a=actions[i],
				id='cbx_'+a,
				el=document.getElementById(id);
			if (el) {
				el.checked=minnesotaSpacewar.getSwitch(a);
				el.addEventListener('change', handlerFactory(a), false);
			}
			el=document.getElementById('lbl_cbx_'+a);
			if (el) {
				addSwitchHandlers(el, 'checkbox', id);
			}
		}
		el=document.getElementById('btn_reset');
		if (el) {
			el.addEventListener('click', minnesotaSpacewar.reset, false);
			addSwitchHandlers(el, 'button', 'btn_reset');
		}
		cableToy.setup();
	}
	function handlerFactory(action) {
		return function() { minnesotaSpacewar.setSwitch(action, this.checked); };
	}
	function addSwitchHandlers(el, type, id) {
		el.addEventListener('mousedown', function() { handleSwichState(type, 'down', id); }, false);
		el.addEventListener('mouseup', function() { handleSwichState(type, 'up', id); }, false);
	}
	function handleSwichState(type, state, id) {
		if (type=='button') {
			minnesotaSpacewar.playSound((state=='down')? 'clunk1':'clunk2');
		}
		else if (type=='checkbox') {
			var el=el=document.getElementById(id);
			if (el) {
				if (state=='down') {
					if (!el.checked) minnesotaSpacewar.playSound('clunk2');
				}
				else {
					if (el.checked) minnesotaSpacewar.playSound('clunk1');
				}
			}
		}
	}
	var emulationPresets= {
		'Minnesota': {
			'salvoes': true,
			'lowgravity': false,
			'gameoflifesun': false,
			'partialdamage': false,
			'mitmode': false,
			'torpedogravity': false,
			'dorpedoextdsupply': false,
			'showstarfield': true,
			'hyperspaceactive': true,
			'showtrails': false,
			'sunkills': true,
			'fuzzytorpedoes': false
		},
		'MIT': {
			'salvoes': true,
			'lowgravity': false,
			'gameoflifesun': false,
			'partialdamage': false,
			'mitmode': true,
			'torpedogravity': false,
			'dorpedoextdsupply': true,
			'showstarfield': true,
			'hyperspaceactive': true,
			'showtrails': true,
			'fuzzytorpedoes': false
		},
		'MITAlternate': {
			'salvoes': true,
			'lowgravity': false,
			'gameoflifesun': false,
			'partialdamage': true,
			'mitmode': true,
			'torpedogravity': true,
			'dorpedoextdsupply': true,
			'showstarfield': true,
			'hyperspaceactive': true,
			'showtrails': true,
			'sunkills': false,
			'fuzzytorpedoes': false
		}
	};
	function setPreset(name) {
		if (!active) return;
		var preset=emulationPresets[name];
		if (preset) {
			for (var k in preset) {
				var v=preset[k];
				minnesotaSpacewar.setSwitch(k, v);
				var el=document.getElementById('cbx_'+k);
				if (el) el.checked=v;
			}
			minnesotaSpacewar.playSound('clunk1');
			setTimeout( function() {minnesotaSpacewar.beep(0.5);}, 250 );
		}
	}
	function showAdvancedSettings() {
		if (!active) return;
		var adv=minnesotaSpacewar.getAdvancedSettings(), f=document.forms.advancedSettings;
		for (var i=0, l=switches.length; i<l; i++) {
			var p=switches[i], v=String(minnesotaSpacewar.getSwitch(p)), r=f.elements['adv_'+p];
			for (var j=0; j<r.length; j++) {
				var re=r[j];
				re.checked=(v==re.value);
			}
		}
		for (p in adv) {
			r=f.elements['adv_'+p], v=String(adv[p]);
			for (j=0; j<r.length; j++) {
				re=r[j];
				re.checked=(v==re.value);
			}
		}
		minnesotaSpacewar.pause(true);
		document.getElementById('advancedSettingsPane').style.display='block';
	}
	function hideAdvancedSettings(applySettings) {
		if (!active) return;
		document.getElementById('advancedSettingsPane').style.display='none';
		if (applySettings) {
			var adv=minnesotaSpacewar.getAdvancedSettings(), f=document.forms.advancedSettings;
			for (var i=0, l=switches.length; i<l; i++) {
				var p=switches[i], r=f.elements['adv_'+p];
				for (var j=0; j<r.length; j++) {
					var re=r[j];
					if (re.checked) {
						var v=(re.value=='true');
						minnesotaSpacewar.setSwitch(p, v);
						var el=document.getElementById('cbx_'+p);
						if (el) el.checked=v;
						break;
					}
				}
			}
			for (p in adv) {
				r=f.elements['adv_'+p];
				for (j=0; j<r.length; j++) {
					re=r[j];
					if (re.checked) {
						adv[p] = (re.value=='true');
						break;
					}
				}
			}
			var el=document.getElementById('cbx_mitmode');
			if (el) el.checked=adv.mitoutlines;
			minnesotaSpacewar.setAdvancedSettings(adv);
			minnesotaSpacewar.playSound('clunk1');
			setTimeout( function() {minnesotaSpacewar.beep(0.5);}, 250 );
		}
		minnesotaSpacewar.pause(false);
	}
	var cableToy = new function() {
		var delta, startY, busy=false, delay=20;
		var cable1Length = 165,
			cable2Length = 85,
			loop1Y = 155,
			loop2Y = 165,
			maxExtension = 90,
			elasticCf = 0.8;
		function setCable(d) {
			if (d!=delta) {
				if (d>maxExtension) d=maxExtension;
				if (d<1) d=0;
				delta=d;
				d=Math.round(d);
				document.getElementById('cable1').style.height=(cable1Length+d)+'px';
				document.getElementById('cable2').style.height=(cable2Length+d)+'px';
				document.getElementById('cableloop1').style.top=(loop1Y+d)+'px';
				document.getElementById('cableloop2').style.top=(loop2Y+d)+'px';
			}
		}
		function setup() {
			var ids=['cable1', 'cable2', 'cableloop1', 'cableloop2'];
			for (var i=0; i<ids.length; i++) {
				var el=document.getElementById(ids[i]);
				if (el) el.addEventListener('mousedown', cableMouseDown, false);
			}
		}
		function cableMouseDown(event) {
			if (!busy) {
				startY=event.pageY||event.clientY;
				document.addEventListener('mousemove', cableDrag, false);
				document.addEventListener('mouseup', cableDrag, false);
				busy=true;
			}
			stopEvent(event);
		}
		function cableDrag(event) {
			var y=event.pageY||event.clientY;
			setCable(y-startY);
			if (event.type=='mouseup' /*|| delta==maxExtension*/) {
				document.removeEventListener('mousemove', cableDrag);
				document.removeEventListener('mouseup', cableDrag);
				setTimeout(cableReset, delay);
			}
			stopEvent(event);
		}
		function cableReset() {
			setCable(delta*elasticCf);
			if (delta) {
				setTimeout(cableReset, delay);
			}
			else {
				busy=false;
			}
		}
		function stopEvent(e) {
			if (e.preventDefault) e.preventDefault();
			if (e.stopPropagation) e.stopPropagation();
		}
		return {
			setup: setup
		};
	};
	// internal
	function setKeyLang(n) {
		minnesotaSpacewar.setKeyLang(n);
		minnesotaSpacewar.reset();
	}
	function setControls(key, value) {
		minnesotaSpacewar.setControls(key, value);
	}
	function setSwitch(key, value) {
		var el=document.getElementById('cbx_'+key);
		if (el) {
			minnesotaSpacewar.setSwitch(key, value);
			el.checked=minnesotaSpacewar.getSwitch(key);
		}
	}
	minnesotaSpacewar.loadSounds(['clunk1', 'clunk2']);
	
	window.addEventListener('load', uiSetup, false);
	return {
		setKeyLang: setKeyLang,
		setControls: setControls,
		setSwitch: setSwitch,
		setPreset: setPreset,
		showAdvancedSettings: showAdvancedSettings,
		hideAdvancedSettings: hideAdvancedSettings
	}
};

//eof