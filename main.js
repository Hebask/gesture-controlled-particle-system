import * as THREE from 'https://cdn.skypack.dev/three@0.160.0';
import { GUI } from 'https://cdn.skypack.dev/three@0.160.0/examples/jsm/libs/lil-gui.module.min.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- INITIAL SETTINGS ---
const count = 30000;
let smoothedExp = 1.0;
const settings = {
    color: 0x00d2ff,
    pattern: 'Sphere',
    bloomStrength: 1.5
};

// --- SHADER DEFINITIONS ---
const vShader = `
    uniform float uTime;
    uniform float uExpansion;
    attribute vec3 aTarget;
    varying float vDistance;

    void main() {
        // Morph logic: position is current, aTarget is destination
        vec3 pos = mix(position, aTarget, 0.1); 
        
        // Add "Magical" ripple noise
        float noise = sin(pos.y * 1.5 + uTime) * 0.15;
        pos *= (uExpansion + noise);

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vDistance = length(pos);
        
        gl_PointSize = 4.0 * (2.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fShader = `
    uniform vec3 uColor;
    varying float vDistance;
    void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        // Color intensity based on center distance
        float alpha = 1.0 - (d * 2.0);
        gl_FragColor = vec4(uColor, alpha);
    }
`;

// --- CORE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('webgl'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// --- GEOMETRY & PATTERNS ---
const geometry = new THREE.BufferGeometry();
const posArray = new Float32Array(count * 3);
const targetArray = new Float32Array(count * 3);

function setPattern(type) {
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        let x, y, z;
        if (type === 'Sphere') {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            x = 2 * Math.cos(theta) * Math.sin(phi);
            y = 2 * Math.sin(theta) * Math.sin(phi);
            z = 2 * Math.cos(phi);
        } else if (type === 'DNA') {
            const t = (i / count) * Math.PI * 15;
            const strand = i % 2 === 0 ? 0 : Math.PI;
            x = Math.cos(t + strand) * 1.5;
            y = (i / count - 0.5) * 10;
            z = Math.sin(t + strand) * 1.5;
        } else if (type === 'Vortex') {
            const t = (i / count) * Math.PI * 2;
            x = (2 + 0.5 * Math.cos(3 * t)) * Math.cos(2 * t);
            y = (2 + 0.5 * Math.cos(3 * t)) * Math.sin(2 * t);
            z = 0.5 * Math.sin(3 * t);
        }

        gsap.to(targetArray, {
            [i3]: x, [i3+1]: y, [i3+2]: z,
            duration: 2, ease: "power3.inOut",
            onUpdate: () => { geometry.attributes.aTarget.needsUpdate = true; }
        });
    }
}

// Initial Fill
for(let i=0; i<count*3; i++) posArray[i] = (Math.random()-0.5)*10;
geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
geometry.setAttribute('aTarget', new THREE.BufferAttribute(targetArray, 3));

const material = new THREE.ShaderMaterial({
    vertexShader: vShader, fragmentShader: fShader,
    uniforms: { uTime: { value: 0 }, uExpansion: { value: 1 }, uColor: { value: new THREE.Color(settings.color) } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});

const points = new THREE.Points(geometry, material);
scene.add(points);
setPattern('Sphere');

// --- BLOOM (THE GLOW) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
composer.addPass(bloom);

// --- HAND TRACKING ---
const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6 });
hands.onResults(res => {
    if (res.multiHandLandmarks && res.multiHandLandmarks[0]) {
        const h = res.multiHandLandmarks[0];
        const dist = Math.hypot(h[8].x - h[4].x, h[8].y - h[4].y);
        const targetExp = THREE.MathUtils.mapLinear(dist, 0.05, 0.4, 0.4, 3.5);
        smoothedExp = THREE.MathUtils.lerp(smoothedExp, targetExp, 0.15);
        material.uniforms.uExpansion.value = smoothedExp;
    }
});
const cam = new Camera(document.getElementById('video'), { onFrame: async () => await hands.send({image: video}), width: 640, height: 480 });
cam.start();

// --- UI ---
const gui = new GUI();
gui.addColor(settings, 'color').onChange(v => material.uniforms.uColor.value.set(v));
gui.add(settings, 'pattern', ['Sphere', 'DNA', 'Vortex']).onChange(v => setPattern(v));
document.getElementById('fullscreen-btn').onclick = () => document.documentElement.requestFullscreen();

// --- LOOP ---
function animate() {
    requestAnimationFrame(animate);
    material.uniforms.uTime.value = performance.now() * 0.002;
    points.rotation.y += 0.003;
    composer.render();
}
animate();