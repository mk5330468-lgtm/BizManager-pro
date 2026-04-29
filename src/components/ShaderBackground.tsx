import React, { useEffect, useRef } from 'react';

interface ShaderBackgroundProps {
  className?: string;
}

const ShaderBackground: React.FC<ShaderBackgroundProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // Enable extension for fwidth
    gl.getExtension('OES_standard_derivatives');

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      #extension GL_OES_standard_derivatives : enable
      precision highp float;
      uniform float time;
      uniform vec2 resolution;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        
        // Dark background base
        vec3 color = vec3(0.02, 0.02, 0.05);

        // Animated Plasma
        float t = time * 0.2;
        float n = noise(p * 1.5 + t);
        n += 0.5 * noise(p * 3.0 - t * 0.5);
        n += 0.25 * noise(p * 6.0 + t);
        
        // Purple-Blue gradients based on noise
        vec3 blue = vec3(0.1, 0.3, 0.8);
        vec3 purple = vec3(0.6, 0.2, 0.9);
        vec3 plasma = mix(blue, purple, sin(n * 3.0 + t) * 0.5 + 0.5);
        
        color = mix(color, plasma, n * 0.15);

        // Grid lines with perspective-like distortion
        vec2 gridUv = p * 4.0;
        gridUv.x += sin(gridUv.y * 0.5 + t) * 0.2;
        vec2 grid = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
        float line = min(grid.x, grid.y);
        float gridAlpha = (1.0 - smoothstep(0.0, 0.05, line)) * 0.15;
        
        // Add glow to grid intersections
        float dots = smoothstep(0.4, 0.5, 1.0 - length(fract(gridUv) - 0.5));
        gridAlpha += dots * 0.1;
        
        color += gridAlpha * plasma;

        // Interactive-feeling glow
        float glow = 0.05 / (length(p) + 0.5);
        color += glow * plasma * 0.5;

        // Subtle CRT-like scanning lines
        float scan = sin(gl_FragCoord.y * 0.5) * 0.02;
        color += scan * plasma;

        // Final output with vignette
        float vignette = 1.0 - length(uv - 0.5) * 1.2;
        gl_FragColor = vec4(color * clamp(vignette, 0.4, 1.0), 1.0);
      }
    `;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) return;
    
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vs || !fs) return;
    
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    const timeLocation = gl.getUniformLocation(program, 'time');
    const resolutionLocation = gl.getUniformLocation(program, 'resolution');

    const resize = () => {
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      
      // Cap pixel ratio for performance - 1.5 is enough for retina-like smoothness without the GPU load of 3x or 4x
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.floor(displayWidth * dpr);
      const height = Math.floor(displayHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    let animationFrameId: number;
    const render = (time: number) => {
      resize();
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(timeLocation, time * 0.001);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 w-full h-full pointer-events-none ${className}`}
    />
  );
};

export default ShaderBackground;
