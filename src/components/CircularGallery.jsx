import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Camera,
  Mesh,
  Plane,
  Program,
  Renderer,
  Texture,
  Transform,
} from 'ogl';
import {
  attachIdleLoopCapture,
  blitIdleLoopReverse,
  disposeIdleLoopTape,
  idleLoopUsesNativeLoop,
  mountIdleLoopVideo,
  stepIdleLoopPingPong,
  unmountIdleLoopVideo,
} from './ui/idleLoopSeam';
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}
function autoBind(instance) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== 'constructor' && typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });
}
function createTextTexture(
  gl,
  text,
  font = 'bold 30px monospace',
  color = 'black'
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = font;
  const metrics = context.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = Math.ceil(parseInt(font, 10) * 1.2);
  canvas.width = textWidth + 20;
  canvas.height = textHeight + 20;
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width: canvas.width, height: canvas.height };
}
// Create a placeholder texture for null images
function createPlaceholderTexture(
  gl,
  type = 'avatar',
  width = 512,
  height = 512
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  // Create dark gradient background for glassmorphism effect
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    width / 2
  );
  gradient.addColorStop(0, 'rgba(30, 30, 30, 0.8)'); // Dark center
  gradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)'); // Darker edges
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  // Add subtle border
  context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);
  // Draw icon based on type with lighter color
  context.fillStyle = 'rgba(200, 200, 200, 0.6)'; // Lighter gray for better contrast
  context.font = 'bold 48px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (type === 'create') {
    // Nothing is drawn on the Create Avatar card: a live PixelCard is laid
    // over this slot by the gallery's parent and tracks it as it scrolls, so
    // anything painted here would show through the card's glass.
  } else {
    // Draw user icon (simplified)
    const centerX = width / 2;
    const centerY = height / 2;
    // Head (circle)
    context.beginPath();
    context.arc(centerX, centerY - 30, 30, 0, Math.PI * 2);
    context.fill();
    // Body (arc)
    context.beginPath();
    context.arc(centerX, centerY + 60, 50, 0, Math.PI, true);
    context.fill();
  }
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = canvas;
  return { texture, width, height };
}
class Title {
  constructor({
    gl,
    plane,
    renderer,
    text,
    textColor = '#545050',
    font = '30px sans-serif',
  }) {
    autoBind(this);
    this.gl = gl;
    this.plane = plane;
    this.renderer = renderer;
    this.text = text;
    this.textColor = textColor;
    this.font = font;
    this.createMesh();
  }
  createMesh() {
    const { texture, width, height } = createTextTexture(
      this.gl,
      this.text,
      this.font,
      this.textColor
    );
    const geometry = new Plane(this.gl);
    const program = new Program(this.gl, {
      vertex: `
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.1) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: { tMap: { value: texture } },
      transparent: true,
    });
    this.mesh = new Mesh(this.gl, { geometry, program });
    const aspect = width / height;
    const textHeight = this.plane.scale.y * 0.15;
    const textWidth = textHeight * aspect;
    this.mesh.scale.set(textWidth, textHeight, 1);
    // Below the avatar icon
    // this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;

    // Above the avatar icon
    this.mesh.position.y = this.plane.scale.y * 0.5 + textHeight * 0.5 + 0.05;

    this.mesh.setParent(this.plane);
  }
}
class Media {
  constructor({
    geometry,
    gl,
    image,
    index,
    length,
    renderer,
    scene,
    screen,
    text,
    viewport,
    bend,
    textColor,
    borderRadius = 0,
    font,
    onCardClick,
    cardType = 'avatar', // New prop to identify card type
    video = null,
  }) {
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    // The avatar's neutral idle loop, when one has been generated. The still
    // is shown until the first frame decodes, then the texture is refreshed
    // from the video every frame so the card breathes and blinks in place.
    this.video = video;
    this.videoElement = null;
    this.loopDirection = 1;
    this.index = index;
    this.length = length;
    this.renderer = renderer;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor;
    this.borderRadius = borderRadius;
    this.font = font;
    this.onCardClick = onCardClick;
    this.cardType = cardType;
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }
  createShader() {
    const texture = new Texture(this.gl, {
      generateMipmaps: true,
    });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;
        
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        
        void main() {
          float planeAspect = max(uPlaneSizes.x, 0.0001) / max(uPlaneSizes.y, 0.0001);
          float imageAspect = max(uImageSizes.x, 0.0001) / max(uImageSizes.y, 0.0001);
          // Contain on the same transparent-black glass as the Create Avatar card.
          vec2 scale = imageAspect > planeAspect
            ? vec2(1.0, planeAspect / imageAspect)
            : vec2(imageAspect / planeAspect, 1.0);
          vec2 uv = (vUv - 0.5) / scale + 0.5;

          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          float edgeSmooth = 0.002;
          float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);
          float strokeWidth = 0.0035;
          float inner = roundedBoxSDF(
            vUv - 0.5,
            vec2(0.5 - uBorderRadius - strokeWidth),
            max(uBorderRadius - strokeWidth, 0.0)
          );
          float stroke = smoothstep(-0.0015, 0.0015, inner) *
            (1.0 - smoothstep(-0.0015, 0.0015, d));
          vec3 frame = vec3(1.0);

          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(mix(vec3(0.0), frame, stroke * 0.25), alpha * 0.6);
            return;
          }
          vec4 color = texture2D(tMap, uv);
          gl_FragColor = vec4(mix(color.rgb, frame, stroke * 0.25), color.a * alpha);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius },
      },
      transparent: true,
    });
    this.texture = texture;
    // Handle null/invalid images
    if (!this.image) {
      // Create placeholder texture
      const {
        texture: placeholderTexture,
        width,
        height,
      } = createPlaceholderTexture(this.gl, this.cardType, 512, 512);
      this.program.uniforms.tMap.value = placeholderTexture;
      this.program.uniforms.uImageSizes.value = [width, height];
      this.startIdleLoop();
    } else {
      // Load actual image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.src = this.image;
      img.onload = () => {
        texture.image = img;
        this.program.uniforms.uImageSizes.value = [
          img.naturalWidth,
          img.naturalHeight,
        ];
        this.startIdleLoop();
      };
      img.onerror = () => {
        // Fallback to placeholder if image fails to load
        console.warn(`Failed to load image: ${this.image}, using placeholder`);
        const {
          texture: placeholderTexture,
          width,
          height,
        } = createPlaceholderTexture(this.gl, this.cardType, 512, 512);
        this.program.uniforms.tMap.value = placeholderTexture;
        this.program.uniforms.uImageSizes.value = [width, height];
      };
    }
  }
  startIdleLoop() {
    if (!this.video || this.videoElement) return;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    video.src = this.video;
    video.addEventListener('error', () => {
      // A loop that will not play leaves the still in place; nothing else to do.
      this.videoElement = null;
    });
    mountIdleLoopVideo(video);
    attachIdleLoopCapture(video);
    video.play().catch(() => {
      // Autoplay refused (no user gesture yet): the still stays until the
      // page is interacted with, when the next update() tries again.
    });
    this.videoElement = video;
  }
  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program,
    });
    this.plane.setParent(this.scene);
  }
  createTitle() {
    this.title = new Title({
      gl: this.gl,
      plane: this.plane,
      renderer: this.renderer,
      text: this.text,
      textColor: this.textColor,
      fontFamily: this.font,
    });
  }
  update(scroll, direction) {
    // Refresh the card's texture from the idle loop once it has frames.
    const video = this.videoElement;
    if (video && video.readyState >= 2 && this.texture) {
      this.loopDirection = stepIdleLoopPingPong(video, this.loopDirection);
      video.loop = idleLoopUsesNativeLoop(video);
      video._idleLoopAllowCapture = !(this.isBefore || this.isAfter);
      const reverseSurface = blitIdleLoopReverse(video);
      const textureSource = reverseSurface || video;
      if (this.texture.image !== textureSource) {
        this.texture.image = textureSource;
      }
      const sourceWidth = reverseSurface?.width || video.videoWidth;
      const sourceHeight = reverseSurface?.height || video.videoHeight;
      if (sourceWidth > 0 && sourceHeight > 0) {
        this.program.uniforms.uImageSizes.value = [sourceWidth, sourceHeight];
      }
      this.texture.needsUpdate = true;
    }
    this.plane.position.x = this.x - scroll.current - this.extra;
    const x = this.plane.position.x;
    const H = this.viewport.width / 2;
    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B_abs = Math.abs(this.bend);
      const R = (H * H + B_abs * B_abs) / (2 * B_abs);
      const effectiveX = Math.min(Math.abs(x), H);
      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
      }
    }
    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = this.speed;
    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === 'right' && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === 'left' && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }
  onResize({ screen, viewport } = {}) {
    if (screen) this.screen = screen;
    if (viewport) {
      this.viewport = viewport;
      if (this.plane.program.uniforms.uViewportSizes) {
        this.plane.program.uniforms.uViewportSizes.value = [
          this.viewport.width,
          this.viewport.height,
        ];
      }
    }
    this.scale = this.screen.height / 1500;
    // Square: a 7:9 plane cropped the sides of square portraits and idle loops.
    this.plane.scale.y =
      (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x =
      (this.viewport.width * (900 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [
      this.plane.scale.x,
      this.plane.scale.y,
    ];
    this.padding = 2;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}
class App {
  constructor(
    container,
    {
      items,
      bend,
      textColor = '#ffffff',
      borderRadius = 0,
      font = 'bold 30px Figtree',
      scrollSpeed = 2,
      scrollEase = 0.05,
      onCardClick,
      currentIndex = 0,
      onIndexChange,
      onCreateCardMove,
    } = {}
  ) {
    document.documentElement.classList.remove('no-js');
    this.container = container;
    this.scrollSpeed = scrollSpeed;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this.onCheck, 200);
    this.onCardClick = onCardClick;
    this.currentIndex = currentIndex;
    this.onIndexChange = onIndexChange;
    this.onCreateCardMove = onCreateCardMove;
    this.isExternalControl = false;
    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias(items, bend, textColor, borderRadius, font);
    this.update();
    this.addEventListeners();
    // Set initial position based on currentIndex
    this.setCurrentIndex(currentIndex, false);
  }
  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }
  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }
  createScene() {
    this.scene = new Transform();
  }
  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 50,
      widthSegments: 100,
    });
  }
  createMedias(items, bend = 1, textColor, borderRadius, font) {
    // No stand-in imagery. An empty gallery means the user has no avatars yet,
    // and filling it with stock photographs of bridges and strawberries made an
    // empty account look like a populated one.
    const galleryItems = items && items.length ? items : [];
    this.originalItems = galleryItems;
    // this.mediasImages = galleryItems.concat(galleryItems);
    this.mediasImages = galleryItems; // <-- instead of galleryItems.concat(galleryItems)
    this.medias = this.mediasImages.map((data, index) => {
      return new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image: data.image,
        video: data.video ?? null,
        index,
        length: this.mediasImages.length,
        renderer: this.renderer,
        scene: this.scene,
        screen: this.screen,
        text: data.text,
        viewport: this.viewport,
        bend,
        textColor,
        borderRadius,
        font,
        onCardClick: this.onCardClick,
        cardType: data.type || 'avatar', // Pass card type
      });
    });
  }
  onTouchDown(e) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = e.touches ? e.touches[0].clientX : e.clientX;
  }
  onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
  }
  onTouchUp() {
    this.isDown = false;
    this.onCheck();
  }
  onWheel(e) {
    const delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target +=
      (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  }
  onClick(e) {
    if (!this.medias || !this.medias[0]) return;
    const rect = this.gl.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const centerX = rect.width / 2;
    // Check if clicked on the center card (current card)
    const cardWidth = this.medias[0].width * (rect.width / this.viewport.width);
    const cardLeft = centerX - cardWidth / 2;
    const cardRight = centerX + cardWidth / 2;
    if (x >= cardLeft && x <= cardRight && this.onCardClick) {
      // Get the current item data
      const currentItemIndex = this.getCurrentItemIndex();
      const itemData = this.originalItems[currentItemIndex];
      if (itemData) {
        this.onCardClick(itemData);
      }
    }
  }
  onCheck() {
    if (!this.medias || !this.medias[0]) return;
    const width = this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    const item = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
    // Update current index and notify parent
    const newIndex = this.getCurrentItemIndex();
    if (newIndex !== this.currentIndex && !this.isExternalControl) {
      this.currentIndex = newIndex;
      if (this.onIndexChange) {
        this.onIndexChange(newIndex);
      }
    }
  }
  getCurrentItemIndex() {
    if (!this.medias || !this.medias[0]) return 0;
    const width = this.medias[0].width;
    const itemIndex = Math.round(this.scroll.target / width);
    const len = this.originalItems.length;
    return ((itemIndex % len) + len) % len;
  }

  setCurrentIndex(index, animate = true) {
    if (!this.medias || !this.medias[0]) return;
    this.isExternalControl = true;
    const width = this.medias[0].width;
    const targetPosition = width * index;
    if (animate) {
      this.scroll.target = targetPosition;
    } else {
      this.scroll.target = targetPosition;
      this.scroll.current = targetPosition;
    }
    this.currentIndex = index;
    // Reset external control flag after a short delay
    setTimeout(() => {
      this.isExternalControl = false;
    }, 100);
  }
  onResize() {
    this.screen = {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({
      aspect: this.screen.width / this.screen.height,
    });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) {
      this.medias.forEach((media) =>
        media.onResize({ screen: this.screen, viewport: this.viewport })
      );
    }
  }
  /**
   * Tell the parent where the Create Avatar slot is on screen this frame.
   *
   * The slot's plane position is in viewport units; converting through the
   * container's pixel width gives the offset from the gallery's centre that
   * a DOM element laid over the slot needs. Reported every frame, so the
   * overlay moves with the drag rather than snapping when the index settles.
   */
  reportCreateCardPosition() {
    if (!this.onCreateCardMove || !this.medias || !this.viewport || !this.screen) {
      return;
    }
    const createMedia = this.medias.find((media) => media.cardType === 'create');
    if (!createMedia) return;
    const xInPixels =
      (createMedia.plane.position.x / this.viewport.width) * this.screen.width;
    this.onCreateCardMove({
      x: xInPixels,
      visible: !(createMedia.isBefore || createMedia.isAfter),
    });
  }
  update() {
    this.scroll.current = lerp(
      this.scroll.current,
      this.scroll.target,
      this.scroll.ease
    );
    const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll, direction));
    }
    this.reportCreateCardPosition();
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update.bind(this));
  }
  addEventListeners() {
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    this.boundOnClick = this.onClick.bind(this);
    window.addEventListener('resize', this.boundOnResize);
    window.addEventListener('mousewheel', this.boundOnWheel);
    window.addEventListener('wheel', this.boundOnWheel);
    window.addEventListener('mousedown', this.boundOnTouchDown);
    window.addEventListener('mousemove', this.boundOnTouchMove);
    window.addEventListener('mouseup', this.boundOnTouchUp);
    window.addEventListener('touchstart', this.boundOnTouchDown);
    window.addEventListener('touchmove', this.boundOnTouchMove);
    window.addEventListener('touchend', this.boundOnTouchUp);
    this.gl.canvas.addEventListener('click', this.boundOnClick);
  }
  destroy() {
    window.cancelAnimationFrame(this.raf);
    if (this.medias) {
      this.medias.forEach((media) => {
        if (media.videoElement) {
          disposeIdleLoopTape(media.videoElement);
          media.videoElement.pause();
          unmountIdleLoopVideo(media.videoElement);
          media.videoElement.removeAttribute('src');
          media.videoElement.load();
          media.videoElement = null;
        }
      });
    }
    window.removeEventListener('resize', this.boundOnResize);
    window.removeEventListener('mousewheel', this.boundOnWheel);
    window.removeEventListener('wheel', this.boundOnWheel);
    window.removeEventListener('mousedown', this.boundOnTouchDown);
    window.removeEventListener('mousemove', this.boundOnTouchMove);
    window.removeEventListener('mouseup', this.boundOnTouchUp);
    window.removeEventListener('touchstart', this.boundOnTouchDown);
    window.removeEventListener('touchmove', this.boundOnTouchMove);
    window.removeEventListener('touchend', this.boundOnTouchUp);
    if (this.gl && this.gl.canvas) {
      this.gl.canvas.removeEventListener('click', this.boundOnClick);
    }
    if (
      this.renderer &&
      this.renderer.gl &&
      this.renderer.gl.canvas.parentNode
    ) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas);
    }
  }
}
const CircularGallery = forwardRef(
  (
    {
      items,
      bend = 0,
      textColor = '#ffffff',
      borderRadius = 0.05,
      font = 'bold 30px Figtree',
      scrollSpeed = 2,
      scrollEase = 0.05,
      onCardClick,
      currentIndex = 0,
      onIndexChange,
      onCreateCardMove,
    },
    ref
  ) => {
    const containerRef = useRef(null);
    const appRef = useRef(null);
    useImperativeHandle(ref, () => ({
      setCurrentIndex: (index, animate = true) => {
        if (appRef.current) {
          appRef.current.setCurrentIndex(index, animate);
        }
      },
      getCurrentIndex: () => {
        if (appRef.current) {
          return appRef.current.getCurrentItemIndex();
        }
        return 0;
      },
    }));
    useEffect(() => {
      const app = new App(containerRef.current, {
        items,
        bend,
        textColor,
        borderRadius,
        font,
        scrollSpeed,
        scrollEase,
        onCardClick,
        currentIndex,
        onIndexChange,
        onCreateCardMove,
      });
      appRef.current = app;
      return () => {
        app.destroy();
        appRef.current = null;
      };
    }, [items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase]);
    // Update current index when prop changes
    useEffect(() => {
      if (appRef.current && appRef.current.currentIndex !== currentIndex) {
        appRef.current.setCurrentIndex(currentIndex, true);
      }
    }, [currentIndex]);
    return (
      <div
        className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing bg-black/60 backdrop-blur-lg"
        ref={containerRef}
      />
    );
  }
);
CircularGallery.displayName = 'CircularGallery';
export default CircularGallery;
