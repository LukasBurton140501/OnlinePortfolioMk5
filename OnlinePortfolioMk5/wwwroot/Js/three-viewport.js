let threeModulePromise = null;

async function loadThree() {
    if (!threeModulePromise) {
        threeModulePromise = (async () => {
            const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js');

            const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js');
            const { OBJLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/OBJLoader.js');
            const { MTLLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/MTLLoader.js');
            const { FBXLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FBXLoader.js');

            return { THREE, OrbitControls, OBJLoader, MTLLoader, FBXLoader };
        })();
    }
    return threeModulePromise;
}

export async function createThreeViewport(hostEl, options) {
    const { THREE, OrbitControls, OBJLoader, MTLLoader, FBXLoader } = await loadThree();

    const state = {
        renderer: null, scene: null, camera: null, controls: null, animId: 0, model: null
    };

    // Scene
    const scene = new THREE.Scene();
    if (options.background && options.background !== 'transparent') {
        scene.background = new THREE.Color(options.background);
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(60, hostEl.clientWidth / hostEl.clientHeight, 0.1, 1000);
    camera.position.set(2.5, 2, 3);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(hostEl.clientWidth, hostEl.clientHeight);
    hostEl.innerHTML = ''; // clear
    hostEl.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 7);
    dir.castShadow = false;
    scene.add(dir);

    // Ground (subtle)
    const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    scene.add(grid);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.autoRotate = !!options.autoRotate;
    controls.autoRotateSpeed = 0.5;

    // Helpers
    function fitToObject(obj) {
        const box = new THREE.Box3().setFromObject(obj);
        if (!isFinite(box.max.length())) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Position camera to frame the object
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitDist = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360));
        const dist = fitDist * 1.5;

        camera.position.copy(center.clone().add(new THREE.Vector3(dist, dist * 0.6, dist)));
        camera.near = dist / 100;
        camera.far = dist * 100;
        camera.updateProjectionMatrix();

        controls.target.copy(center);
        controls.update();
    }

    async function loadModel(src, mtl) {
        if (!src) return;

        const ext = src.split('.').pop()?.toLowerCase();

        // Clear previous
        if (state.model) {
            scene.remove(state.model);
            state.model.traverse((c) => {
                if (c.geometry) c.geometry.dispose?.();
                if (c.material) {
                    const mats = Array.isArray(c.material) ? c.material : [c.material];
                    mats.forEach(m => {
                        // dispose textures if any
                        for (const k in m) {
                            const val = m[k];
                            if (val && val.isTexture) val.dispose?.();
                        }
                        m.dispose?.();
                    });
                }
            });
            state.model = null;
        }

        try {
            let root = null;

            if (ext === 'obj') {
                if (mtl) {
                    const mtlLoader = new MTLLoader();
                    const materials = await mtlLoader.loadAsync(mtl);
                    materials.preload();
                    const objLoader = new OBJLoader();
                    objLoader.setMaterials(materials);
                    root = await objLoader.loadAsync(src);
                } else {
                    const objLoader = new OBJLoader();
                    root = await objLoader.loadAsync(src);
                }
            } else if (ext === 'fbx') {
                const fbxLoader = new FBXLoader();
                root = await fbxLoader.loadAsync(src);
            } else {
                throw new Error(`Unsupported model format: .${ext}. Use .obj or .fbx`);
            }

            const scale = Number(options.modelScale ?? 1.0) || 1.0;
            root.scale.setScalar(scale);

            // basic material fallback if unlit
            root.traverse((c) => {
                if (c.isMesh && !c.material) {
                    c.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
                }
                if (c.isMesh) {
                    c.castShadow = false;
                    c.receiveShadow = false;
                }
            });

            scene.add(root);
            state.model = root;
            fitToObject(root);
        } catch (e) {
            console.error(e);
            // simple error sign
            const msg = document.createElement('div');
            msg.style.cssText = "color:#fff;padding:8px;font:14px/1.4 monospace;position:absolute;top:8px;left:8px;background:#d32f2f;border-radius:6px";
            msg.textContent = (e?.message ?? e ?? 'Failed to load model');
            hostEl.appendChild(msg);
        }
    }

    // Render loop
    function animate() {
        state.animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    // Resize
    function onResize() {
        const w = hostEl.clientWidth || hostEl.offsetWidth || 1;
        const h = hostEl.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(hostEl);

    // Store state
    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;
    state.controls = controls;

    // Load the requested model
    await loadModel(options.src, options.mtl);

    // Kick off render
    onResize();
    animate();

    // Return an object with a dispose() method that Blazor will hold on to
    return {
        dispose: () => {
            cancelAnimationFrame(state.animId);
            ro.disconnect();
            state.controls?.dispose?.();
            state.renderer?.dispose?.();
            // cleanup scene
            scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose?.();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => {
                        for (const k in m) {
                            const val = m[k];
                            if (val && val.isTexture) val.dispose?.();
                        }
                        m.dispose?.();
                    });
                }
            });
            // remove canvas
            if (renderer?.domElement?.parentElement === hostEl) {
                hostEl.removeChild(renderer.domElement);
            }
        }
    };
}