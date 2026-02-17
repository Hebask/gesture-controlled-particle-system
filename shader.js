export const vertexShader = `
    uniform float uTime;
    uniform float uExpansion; // Linked to hand gesture
    attribute vec3 aTargetPosition; // The shape (Sphere/Torus)

    void main() {
        // Interpolate between current position and target based on gesture
        vec3 newPosition = mix(position, aTargetPosition * uExpansion, 0.5);
        
        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        gl_PointSize = 4.0 * (1.0 / -mvPosition.z); // Perspective scaling
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const fragmentShader = `
    uniform vec3 uColor;
    void main() {
        // Create a soft circular particle
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(uColor, 1.0 - (dist * 2.0));
    }
`;