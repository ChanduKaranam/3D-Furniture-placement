import "./App.css";
// Import the useEffect hook from React
import { useEffect } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight";

function App() {
  // All of your code is now safely inside the useEffect hook
  useEffect(() => {
    // --- START OF SETUP ---
    let reticle;
    let hitTestSource = null, hitTestSourceRequested = false;
    let firstHitDetected = false, firstObjectPlaced = false;

    let scene, camera, renderer, controller;
    
    let items = [], itemSelectedIndex = 0;
    
    const models = [
      "./1.glb", "./2.glb", "./3.glb",
      "./4.glb", "./5.glb", "./6.glb",
    ];
    const modelScaleFactor = [0.01, 0.01, 0.005, 0.4, 0.3, 0.01];

    // --- ALL FUNCTIONS REMAIN THE SAME ---
    function init() {
      let myCanvas = document.getElementById("canvas");
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(70, myCanvas.innerWidth / myCanvas.innerHeight, 0.01, 20);
      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
      light.position.set(0.5, 1, 0.25);
      scene.add(light);

      renderer = new THREE.WebGLRenderer({ canvas: myCanvas, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(myCanvas.innerWidth, myCanvas.innerHeight);
      renderer.xr.enabled = true;

      const loadingContainer = document.getElementById("loading-container");
      const instructionContainer = document.getElementById("instruction-container");

      renderer.xr.addEventListener("sessionstart", () => {
        firstHitDetected = false;
        firstObjectPlaced = false;
        if (loadingContainer) loadingContainer.style.display = "flex";
        if (instructionContainer) instructionContainer.style.display = "none";
      });
      renderer.xr.addEventListener("sessionend", () => {
        if (loadingContainer) loadingContainer.style.display = "none";
        if (instructionContainer) instructionContainer.style.display = "none";
      });

      const xrLight = new XREstimatedLight(renderer);
      xrLight.addEventListener("estimationstart", () => {
        scene.add(xrLight);
        scene.remove(light);
        if (xrLight.environment) { scene.environment = xrLight.environment; }
      });
      xrLight.addEventListener("estimationend", () => {
        scene.add(light);
        scene.remove(xrLight);
      });

      let arButton = ARButton.createButton(renderer, {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "light-estimation"],
        domOverlay: { root: document.body },
      });
      arButton.id = "ARButton";
      arButton.style.bottom = "28%";
      arButton.style.backgroundColor = "#FF4500";
      arButton.style.color = "white";
      arButton.style.fontWeight = "bold";
      arButton.style.border = "2px solid #FFF";
      arButton.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
      document.body.appendChild(arButton);

      for (let i = 0; i < models.length; i++) {
        const loader = new GLTFLoader();
        loader.load(models[i], (glb) => { items[i] = glb.scene; });
      }

      controller = renderer.xr.getController(0);
      controller.addEventListener("select", onSelect);
      scene.add(controller);

      reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
    }

    function onSelect() {
      if (!firstObjectPlaced) {
        const instructionContainer = document.getElementById("instruction-container");
        if (instructionContainer) instructionContainer.style.display = "none";
        firstObjectPlaced = true;
      }

      // START: ADDED SAFETY CHECK
      // Check if the reticle is visible AND if the selected model has been loaded.
      if (reticle.visible && items[itemSelectedIndex]) {
      // END: ADDED SAFETY CHECK
        
        let newModel = items[itemSelectedIndex].clone();
        newModel.visible = true;
        reticle.matrix.decompose(newModel.position, newModel.quaternion, newModel.scale);
        let scaleFactor = modelScaleFactor[itemSelectedIndex];
        newModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        scene.add(newModel);
      }
    }

    const onClicked = (e, selectItem, index) => {
      itemSelectedIndex = index;
      for (let i = 0; i < models.length; i++) {
        document.querySelector(`#item` + i).classList.remove("clicked");
      }
      e.target.classList.add("clicked");
    };

    function setupFurnitureSelection() {
      for (let i = 0; i < models.length; i++) {
        const el = document.querySelector(`#item` + i);
        el.addEventListener("beforexrselect", (e) => { e.preventDefault(); e.stopPropagation(); });
        el.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onClicked(e, items[i], i);
        });
      }
    }

    function animate() {
      renderer.setAnimationLoop(render);
    }

    function render(timestamp, frame) {
      if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();
        if (hitTestSourceRequested === false) {
          session.requestReferenceSpace("viewer").then((referenceSpace) => {
            session.requestHitTestSource({ space: referenceSpace }).then((source) => {
              hitTestSource = source;
            });
          });
          session.addEventListener("end", () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
          });
          hitTestSourceRequested = true;
        }
        if (hitTestSource) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            if (!firstHitDetected) {
              const loadingContainer = document.getElementById("loading-container");
              if (loadingContainer) loadingContainer.style.display = "none";
              const instructionContainer = document.getElementById("instruction-container");
              if (instructionContainer) instructionContainer.style.display = "block";
              firstHitDetected = true;
            }
          } else {
            reticle.visible = false;
          }
        }
      }
      renderer.render(scene, camera);
    }
    
    // --- INVOCATION ---
    init();
    setupFurnitureSelection();
    animate();

    // --- BEST PRACTICE CLEANUP ---
    return () => {
      renderer.setAnimationLoop(null);
      const arButton = document.getElementById('ARButton');
      if (arButton) {
        document.body.removeChild(arButton);
      }
      renderer.dispose();
    };

  }, []); // The empty array ensures this effect runs only ONCE.

  return <div className="App"></div>;
}

export default App;