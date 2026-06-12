/**
 * CAD Visual Prototype Viewer - Three.js Implementation
 * Handles 3D rendering of the cobot and end-effector pallet, materials, controls, and local STL loading.
 */

class CADViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container #${containerId} not found.`);
            return;
        }

        // Configuration
        this.activeTheme = 'matte-gray';
        this.activeDisplayMode = 'shaded'; // shaded, wireframe, points
        this.isAutoRotating = true;

        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // Model groups
        this.defaultModelGroup = new THREE.Group();
        this.stlModelGroup = new THREE.Group();

        // Materials cache
        this.materials = {};
        this.pointsMaterial = null;

        // Loaded STL track
        this.currentStlMesh = null;

        // Initialization
        this.init();
    }

    init() {
        this.setupScene();
        this.setupLights();
        this.setupHelpers();
        this.setupMaterials();
        this.buildDefaultRobot();
        this.setupControls();
        this.setupEventListeners();
        this.animate();
    }

    setupScene() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Create scene
        this.scene = new THREE.Scene();
        // Light subtle vertical gradient for CAD viewport feel
        this.scene.background = new THREE.Color(0x1e293b); // Slate 800
        this.scene.fog = new THREE.FogExp2(0x1e293b, 0.015);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(6, 6, 8);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Clear container and append canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Add main groups to scene
        this.scene.add(this.defaultModelGroup);
        this.scene.add(this.stlModelGroup);
    }

    setupLights() {
        // Ambient light for general soft illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main key light (directional) with shadows
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(5, 10, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 25;
        const d = 6;
        keyLight.shadow.camera.left = -d;
        keyLight.shadow.camera.right = d;
        keyLight.shadow.camera.top = d;
        keyLight.shadow.camera.bottom = -d;
        keyLight.shadow.bias = -0.0005;
        this.scene.add(keyLight);

        // Fill light (softer directional light from opposite side)
        const fillLight = new THREE.DirectionalLight(0xb1e1ff, 0.4);
        fillLight.position.set(-5, 4, -5);
        this.scene.add(fillLight);

        // Bottom bounce light for ground reflection
        const bounceLight = new THREE.DirectionalLight(0x2d3748, 0.2);
        bounceLight.position.set(0, -5, 0);
        this.scene.add(bounceLight);
    }

    setupHelpers() {
        // Grid floor
        const gridHelper = new THREE.GridHelper(20, 40, 0x14bdac, 0x475569); // Teal & Slate grid lines
        gridHelper.position.y = -2;
        gridHelper.material.opacity = 0.25;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        // CAD Axes Helper
        const axesHelper = new THREE.AxesHelper(1.5);
        axesHelper.position.set(-4.5, -1.95, -4.5);
        // Style axes lines
        axesHelper.material.linewidth = 2;
        axesHelper.material.renderOrder = 1;
        this.scene.add(axesHelper);
    }

    setupMaterials() {
        // Matte CAD Gray (SolidWorks style)
        this.materials['matte-gray'] = new THREE.MeshStandardMaterial({
            color: 0x94a3b8, // Slate 400
            roughness: 0.5,
            metalness: 0.15,
            side: THREE.DoubleSide
        });

        // Polished Stainless Steel
        this.materials['stainless-steel'] = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0, // Slate 200
            roughness: 0.12,
            metalness: 0.95,
            side: THREE.DoubleSide
        });

        // Brass
        this.materials['brass'] = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // Gold Brass
            roughness: 0.2,
            metalness: 0.85,
            side: THREE.DoubleSide
        });

        // Polished Copper
        this.materials['copper'] = new THREE.MeshStandardMaterial({
            color: 0xb87333,
            roughness: 0.18,
            metalness: 0.9,
            side: THREE.DoubleSide
        });

        // Points Material (for cloud mode)
        this.pointsMaterial = new THREE.PointsMaterial({
            color: 0x14bdac, // Teal points
            size: 0.05,
            sizeAttenuation: true
        });
    }

    getActiveMaterial() {
        return this.materials[this.activeTheme] || this.materials['matte-gray'];
    }

    buildDefaultRobot() {
        const material = this.getActiveMaterial();

        // 1. Base Stand
        const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.8, 32);
        const baseMesh = new THREE.Mesh(baseGeo, material);
        baseMesh.position.y = -1.6;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.defaultModelGroup.add(baseMesh);

        // 2. Base Joint Ring
        const ringGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32);
        const ringMesh = new THREE.Mesh(ringGeo, material);
        ringMesh.position.y = -1.05;
        ringMesh.castShadow = true;
        this.defaultModelGroup.add(ringMesh);

        // 3. Lower Joint (Shoulder)
        const shoulderGeo = new THREE.SphereGeometry(0.42, 32, 32);
        const shoulderMesh = new THREE.Mesh(shoulderGeo, material);
        shoulderMesh.position.y = -0.7;
        shoulderMesh.castShadow = true;
        this.defaultModelGroup.add(shoulderMesh);

        // 4. Lower Link (Thick lower arm cylindrical column, extending upwards and slightly angled)
        const lowerArmGroup = new THREE.Group();
        lowerArmGroup.position.set(0, -0.7, 0);

        const lowerLinkGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 32);
        const lowerLinkMesh = new THREE.Mesh(lowerLinkGeo, material);
        lowerLinkMesh.position.y = 0.9;
        lowerLinkMesh.castShadow = true;
        lowerLinkMesh.receiveShadow = true;
        lowerArmGroup.add(lowerLinkMesh);

        // 5. Elbow Joint
        const elbowGeo = new THREE.SphereGeometry(0.35, 32, 32);
        const elbowMesh = new THREE.Mesh(elbowGeo, material);
        elbowMesh.position.y = 1.8;
        elbowMesh.castShadow = true;
        lowerArmGroup.add(elbowMesh);

        // 6. Upper Link (Articulated forearm, extending from elbow)
        const upperArmGroup = new THREE.Group();
        upperArmGroup.position.set(0, 1.8, 0);

        const upperLinkGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.6, 32);
        const upperLinkMesh = new THREE.Mesh(upperLinkGeo, material);
        upperLinkMesh.rotation.z = -0.3; // Angled forward like in the reference image
        upperLinkMesh.position.set(0.25, 0.8, 0);
        upperLinkMesh.castShadow = true;
        upperArmGroup.add(upperLinkMesh);

        // 7. Wrist Assembly
        const wristGroup = new THREE.Group();
        // Pivot point relative to upper arm group
        wristGroup.position.set(0.48, 1.5, 0);

        const wrist1Geo = new THREE.SphereGeometry(0.26, 32, 32);
        const wrist1Mesh = new THREE.Mesh(wrist1Geo, material);
        wrist1Mesh.castShadow = true;
        wristGroup.add(wrist1Mesh);

        // Wrist Extension Cylinder
        const wristExtGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.6, 32);
        const wristExtMesh = new THREE.Mesh(wristExtGeo, material);
        wristExtMesh.rotation.x = Math.PI / 2; // Oriented forward
        wristExtMesh.position.set(0.2, 0.1, 0.2);
        wristExtMesh.castShadow = true;
        wristGroup.add(wristExtMesh);

        // 8. Custom End-Effector (Gripper + Pallet Grid Adapter)
        const gripperGroup = new THREE.Group();
        gripperGroup.position.set(0.2, 0.1, 0.5); // position at the end of the wrist

        // Clamping Adaptor bracket
        const adaptorGeo = new THREE.BoxGeometry(0.4, 0.4, 0.3);
        const adaptorMesh = new THREE.Mesh(adaptorGeo, material);
        adaptorMesh.castShadow = true;
        gripperGroup.add(adaptorMesh);

        // Clamping fingers/prongs holding the pallet
        const prongLGeo = new THREE.BoxGeometry(0.12, 0.3, 0.6);
        const prongL = new THREE.Mesh(prongLGeo, material);
        prongL.position.set(-0.25, 0, 0.35);
        prongL.castShadow = true;
        gripperGroup.add(prongL);

        const prongRGeo = new THREE.BoxGeometry(0.12, 0.3, 0.6);
        const prongR = new THREE.Mesh(prongRGeo, material);
        prongR.position.set(0.25, 0, 0.35);
        prongR.castShadow = true;
        gripperGroup.add(prongR);

        // 9. The Grid Pallet
        // Based on the user's uploaded reference image, this is a large square grid structure.
        const palletGroup = new THREE.Group();
        palletGroup.position.set(0, 0.15, 0.8); // Extended outwards from the gripper jaws
        palletGroup.rotation.x = -0.1; // Slightly tilted like in the CAD mockup

        const palletColorMat = new THREE.MeshStandardMaterial({
            color: 0x64748b, // Darker slate gray for the pallet
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide
        });
        // Save references to apply material themes to pallet as well
        this.materials['pallet-matte'] = palletColorMat;

        // Outer Frame of Pallet
        const frameW = 2.4;
        const frameH = 0.08;
        const frameD = 2.4;
        const frameThickness = 0.06;

        // Top border
        const borderTGeo = new THREE.BoxGeometry(frameW, frameH, frameThickness);
        const borderT = new THREE.Mesh(borderTGeo, palletColorMat);
        borderT.position.set(0, 0, -frameD / 2);
        borderT.castShadow = true;
        palletGroup.add(borderT);

        // Bottom border
        const borderBGeo = new THREE.BoxGeometry(frameW, frameH, frameThickness);
        const borderB = new THREE.Mesh(borderBGeo, palletColorMat);
        borderB.position.set(0, 0, frameD / 2);
        borderB.castShadow = true;
        palletGroup.add(borderB);

        // Left border
        const borderLGeo = new THREE.BoxGeometry(frameThickness, frameH, frameD);
        const borderL = new THREE.Mesh(borderLGeo, palletColorMat);
        borderL.position.set(-frameW / 2, 0, 0);
        borderL.castShadow = true;
        palletGroup.add(borderL);

        // Right border
        const borderRGeo = new THREE.BoxGeometry(frameThickness, frameH, frameD);
        const borderR = new THREE.Mesh(borderRGeo, palletColorMat);
        borderR.position.set(frameW / 2, 0, 0);
        borderR.castShadow = true;
        palletGroup.add(borderR);

        // Grid internal ribs (Grid cells like in the drawing)
        const numRibs = 7;
        const step = frameW / (numRibs + 1);

        // X-axis directional ribs (across left-right)
        for (let i = 1; i <= numRibs; i++) {
            const zPos = -frameD / 2 + i * step;
            const ribGeo = new THREE.BoxGeometry(frameW - 0.05, frameH - 0.01, 0.03);
            const rib = new THREE.Mesh(ribGeo, palletColorMat);
            rib.position.set(0, 0, zPos);
            rib.castShadow = true;
            palletGroup.add(rib);
        }

        // Z-axis directional ribs (across front-back)
        for (let i = 1; i <= numRibs; i++) {
            const xPos = -frameW / 2 + i * step;
            const ribGeo = new THREE.BoxGeometry(0.03, frameH - 0.01, frameD - 0.05);
            const rib = new THREE.Mesh(ribGeo, palletColorMat);
            rib.position.set(xPos, 0, 0);
            rib.castShadow = true;
            palletGroup.add(rib);
        }

        // Corner white locators/grippers
        const locatorGeo = new THREE.BoxGeometry(0.12, 0.16, 0.12);
        const locatorMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 }); // White matte plastic

        const cornerOffsets = [
            [-frameW / 2 + 0.1, frameH / 2, -frameD / 2 + 0.1],
            [frameW / 2 - 0.1, frameH / 2, -frameD / 2 + 0.1],
            [-frameW / 2 + 0.1, frameH / 2, frameD / 2 - 0.1],
            [frameW / 2 - 0.1, frameH / 2, frameD / 2 - 0.1]
        ];

        cornerOffsets.forEach(pos => {
            const locator = new THREE.Mesh(locatorGeo, locatorMat);
            locator.position.set(pos[0], pos[1], pos[2]);
            locator.castShadow = true;
            palletGroup.add(locator);
        });

        gripperGroup.add(palletGroup);
        wristGroup.add(gripperGroup);
        upperArmGroup.add(wristGroup);
        lowerArmGroup.add(upperArmGroup);
        this.defaultModelGroup.add(lowerArmGroup);

        // Adjust positioning so the base sits nicely relative to the origin
        this.defaultModelGroup.position.set(-0.5, 0.5, -0.5);

        // Update display mode based on config
        this.updateDisplayModeForGroup(this.defaultModelGroup);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1; // Limit panning below ground plane
        this.controls.minDistance = 2;
        this.controls.maxDistance = 25;
    }

    setupEventListeners() {
        // Responsiveness
        window.addEventListener('resize', () => this.onWindowResize());

        // Drag and drop events for STL loading
        const viewport = this.container;
        const wrapper = document.getElementById('cad-viewport-wrapper') || viewport;

        // Visual feedback overlays
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.classList.add('dragover');
        });

        wrapper.addEventListener('dragleave', () => {
            wrapper.classList.remove('dragover');
        });

        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.loadLocalSTLFile(files[0]);
            }
        });
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    // Material switching
    setTheme(themeName) {
        if (!this.materials[themeName]) return;
        this.activeTheme = themeName;

        const material = this.getActiveMaterial();

        // Apply to default robot meshes
        this.defaultModelGroup.traverse((child) => {
            if (child.isMesh && child.material !== this.materials['pallet-matte'] && !child.material.color.equals(new THREE.Color(0xf1f5f9))) {
                child.material = material;
            }
        });

        // Apply to custom STL mesh
        if (this.currentStlMesh) {
            this.currentStlMesh.material = material;
        }

        // Keep current display mode configurations
        this.setDisplayMode(this.activeDisplayMode);
    }

    // Display mode switching (Solid/Wireframe/Points)
    setDisplayMode(mode) {
        this.activeDisplayMode = mode;

        this.updateDisplayModeForGroup(this.defaultModelGroup);
        this.updateDisplayModeForGroup(this.stlModelGroup);
    }

    updateDisplayModeForGroup(group) {
        const mode = this.activeDisplayMode;

        group.traverse((child) => {
            // If it's a Points helper generated by us, toggle its visibility
            if (child.name === 'pointsCloudHelper') {
                child.visible = (mode === 'points');
                return;
            }

            // If it's a standard mesh
            if (child.isMesh) {
                if (mode === 'points') {
                    child.visible = false;

                    // Ensure points cloud helper exists
                    let pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (!pointsCloud) {
                        pointsCloud = new THREE.Points(child.geometry, this.pointsMaterial);
                        pointsCloud.name = 'pointsCloudHelper';
                        pointsCloud.uuid = child.uuid + '_points';
                        // Copy transform
                        pointsCloud.position.copy(child.position);
                        pointsCloud.rotation.copy(child.rotation);
                        pointsCloud.scale.copy(child.scale);
                        // Add to child's parent
                        child.parent.add(pointsCloud);
                    }
                    pointsCloud.visible = true;
                } else if (mode === 'wireframe') {
                    child.visible = true;
                    child.material.wireframe = true;
                    
                    // Hide points helper
                    const pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (pointsCloud) pointsCloud.visible = false;
                } else {
                    // Shaded
                    child.visible = true;
                    child.material.wireframe = false;

                    // Hide points helper
                    const pointsCloud = group.getObjectByName(child.uuid + '_points');
                    if (pointsCloud) pointsCloud.visible = false;
                }
            }
        });
    }

    // Reset view
    resetView() {
        this.camera.position.set(6, 6, 8);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    // Load Local STL File
    loadLocalSTLFile(file) {
        if (!file.name.toLowerCase().endsWith('.stl')) {
            this.showError('Invalid file format. Please drop a valid 3D STL file.');
            return;
        }

        this.showLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const contents = event.target.result;
            
            try {
                // Initialize STLLoader
                const loader = new THREE.STLLoader();
                const geometry = loader.parse(contents);

                if (!geometry || geometry.attributes.position.count === 0) {
                    throw new Error("Empty STL geometry");
                }

                // Remove previous STL meshes
                this.clearSTLModel();

                // Create mesh
                const material = this.getActiveMaterial();
                this.currentStlMesh = new THREE.Mesh(geometry, material);
                this.currentStlMesh.castShadow = true;
                this.currentStlMesh.receiveShadow = true;

                // Center and auto-scale the loaded geometry
                geometry.computeBoundingBox();
                geometry.computeBoundingSphere();

                const boundingBox = geometry.boundingBox;
                const size = new THREE.Vector3();
                boundingBox.getSize(size);

                // Auto scale based on size to fit the CAD space nicely
                const maxDim = Math.max(size.x, size.y, size.z);
                const targetScale = 3.5 / maxDim; // Normalize to roughly 3.5 units
                this.currentStlMesh.scale.set(targetScale, targetScale, targetScale);

                // Re-center geometry origin to bounding box center
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);
                geometry.translate(-center.x, -center.y, -center.z);

                // Position loaded model floating slightly above the grid floor
                this.currentStlMesh.position.set(0, 0.2, 0);

                // Add to scene group
                this.stlModelGroup.add(this.currentStlMesh);

                // Hide default robot, show STL
                this.defaultModelGroup.visible = false;
                this.stlModelGroup.visible = true;

                // Show clear/back button
                const clearBtn = document.getElementById('cad-clear-stl');
                if (clearBtn) clearBtn.style.display = 'inline-flex';

                // Show notification success
                this.showSuccess(`Success: "${file.name}" loaded successfully.`);

                // Apply display modes
                this.setDisplayMode(this.activeDisplayMode);

                // Reset camera to focus on new model
                this.resetView();

            } catch (error) {
                console.error(error);
                this.showError('Error parsing STL file. Ensure the file is not corrupted.');
            } finally {
                this.showLoading(false);
            }
        };

        reader.onerror = () => {
            this.showError('Error reading file contents.');
            this.showLoading(false);
        };

        // Read file as ArrayBuffer for STLLoader binary/ASCII support
        reader.readAsArrayBuffer(file);
    }

    clearSTLModel() {
        // Remove children from group and dispose geometries/materials
        while(this.stlModelGroup.children.length > 0) {
            const object = this.stlModelGroup.children[0];
            if (object.geometry) object.geometry.dispose();
            this.stlModelGroup.remove(object);
        }
        this.currentStlMesh = null;
    }

    restoreDefaultModel() {
        this.clearSTLModel();
        this.defaultModelGroup.visible = true;
        
        // Hide clear button
        const clearBtn = document.getElementById('cad-clear-stl');
        if (clearBtn) clearBtn.style.display = 'none';

        // Clear status alert
        this.clearAlert();

        // Reset camera
        this.resetView();
    }

    // UI Feedback Helpers
    showLoading(show) {
        const spinner = document.getElementById('cad-viewer-spinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showAlert(message, type = 'info') {
        const alertEl = document.getElementById('cad-viewer-alert');
        if (!alertEl) return;

        alertEl.textContent = message;
        alertEl.className = `cad-alert alert-${type} show`;

        // Auto hide after 5 seconds if success
        if (type === 'success') {
            setTimeout(() => this.clearAlert(), 5000);
        }
    }

    clearAlert() {
        const alertEl = document.getElementById('cad-viewer-alert');
        if (alertEl) {
            alertEl.className = 'cad-alert';
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Auto rotate models slowly if enabled
        if (this.isAutoRotating) {
            const rotationSpeed = 0.005;
            this.defaultModelGroup.rotation.y += rotationSpeed;
            this.stlModelGroup.rotation.y += rotationSpeed;
        }

        // Update camera position dampers
        if (this.controls) {
            this.controls.update();
        }

        // Render scene
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Bind UI controls after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if viewport div is on the page
    if (document.getElementById('cad-viewport')) {
        const viewer = new CADViewer('cad-viewport');
        window.cadViewerInstance = viewer; // Expose globally for onclick bindings

        // Bind control buttons
        const playBtn = document.getElementById('cad-play-pause');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                viewer.isAutoRotating = !viewer.isAutoRotating;
                playBtn.innerHTML = viewer.isAutoRotating ? '⏸ Pause Orbit' : '▶ Auto Rotate';
                playBtn.classList.toggle('active', viewer.isAutoRotating);
            });
        }

        const resetBtn = document.getElementById('cad-reset-cam');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => viewer.resetView());
        }

        const clearBtn = document.getElementById('cad-clear-stl');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => viewer.restoreDefaultModel());
        }

        // Material selections
        const themeButtons = document.querySelectorAll('.cad-theme-btn');
        themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                themeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const theme = btn.getAttribute('data-theme');
                viewer.setTheme(theme);
            });
        });

        // Display Modes
        const modeButtons = document.querySelectorAll('.cad-mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.getAttribute('data-mode');
                viewer.setDisplayMode(mode);
            });
        });

        // Custom File Input selector
        const fileInput = document.getElementById('cad-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) {
                    viewer.loadLocalSTLFile(files[0]);
                }
            });
        }
    }
});
