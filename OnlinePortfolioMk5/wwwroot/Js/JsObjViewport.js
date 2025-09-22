import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/OBJLoader.js';

function disposeObject3D(obj) {
    obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            const mat = child.material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else mat.dispose?.();
        }
    });
}

export async function create(container, options) {
    const opts = {
        src: null,
        background: '#101012',
        autoRotate: true,
        autoRotateSpeed: 1.2,
        cameraDistance: null,
        ...options
    };

    // Scene & renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.background);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    camera.position.set(0, 0.75, 3);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.05;
    controls.maxDistance = 1000;
    controls.autoRotate = !!opts.autoRotate;
    controls.autoRotateSpeed = opts.autoRotateSpeed;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 8, 5);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x8888ff, 0x222211, 0.35));

    // Resize
    function resize() {
        const { width, height } = container.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Loaders
    const objLoader = new OBJLoader();

    let currentModel = null;
    let animId = 0;

    function frame() {
        animId = requestAnimationFrame(frame);
        controls.update();
        renderer.render(scene, camera);
    }
    frame();

    function frameModelAndCenter(object3D) {
        // Compute bounds
        const box = new THREE.Box3().setFromObject(object3D);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Recenter model at origin
        object3D.position.sub(center);

        // Camera distance to fit
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const fitDist = (maxDim / 2) / Math.tan(fov / 2);

        const distance = opts.cameraDistance ?? fitDist * 1.25;
        camera.position.set(0, 0, distance);
        controls.target.set(0, 0, 0);
        controls.update();
    }

    async function loadObj(src) {
        if (!src) return;

        // Clean up old
        if (currentModel) {
            scene.remove(currentModel);
            disposeObject3D(currentModel);
            currentModel = null;
        }

        // Basic loading with a neutral material fallback if the OBJ has none
        const obj = await new Promise((resolve, reject) => {
            objLoader.load(src, resolve, undefined, reject);
        });

        obj.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.material) {
                    child.material = new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.05, roughness: 0.8 });
                }
            }
        });

        currentModel = obj;
        scene.add(obj);
        frameModelAndCenter(obj);
    }

    if (opts.src) {
        loadObj(opts.src).catch(err => console.error('OBJ load error:', err));
    }

    return {
        // Instance API exposed back to Blazor
        setSrc: (src) => loadObj(src),
        setBackground: (hex) => { scene.background = new THREE.Color(hex || '#101012'); },
        setAutoRotate: (enabled, speed) => { controls.autoRotate = !!enabled; controls.autoRotateSpeed = speed ?? controls.autoRotateSpeed; },
        dispose: () => {
            cancelAnimationFrame(animId);
            ro.disconnect();
            if (currentModel) {
                scene.remove(currentModel);
                disposeObject3D(currentModel);
                currentModel = null;
            }
            renderer.dispose();
            if (renderer.domElement?.parentElement === container) {
                container.removeChild(renderer.domElement);
            }
        }
    };
}