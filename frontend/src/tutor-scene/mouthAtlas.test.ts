import { describe, expect, it } from 'vitest';
import { BufferAttribute, Object3D, Bone, BufferGeometry, Vector3 } from 'three';
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  VISEMES,
  buildMouthGeometry,
  mouthAtlasUrl,
  mouthCardFor,
  toHeadLocal,
  visemeOffset,
} from './mouthAtlas';

describe('visemeOffset', () => {
  it('gives every viseme its own cell', () => {
    const seen = new Set(VISEMES.map((_, index) => visemeOffset(index).join(',')));
    expect(seen.size).toBe(VISEMES.length);
  });

  it('keeps every cell inside the atlas', () => {
    for (let index = 0; index < VISEMES.length; index += 1) {
      const [x, y] = visemeOffset(index);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + 1 / ATLAS_COLUMNS).toBeLessThanOrEqual(1 + 1e-9);
      expect(y + 1 / ATLAS_ROWS).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('puts the first frame in the TOP row, not the bottom', () => {
    // Atlas row 0 is the top of the image while V runs upward. Flipping this is
    // silent — every frame still lands on a valid cell, just the wrong one, and
    // the mouth animates through the right shapes in the wrong order.
    expect(visemeOffset(0)).toEqual([0, 1 - 1 / ATLAS_ROWS]);
  });

  it('wraps rather than sampling outside the atlas', () => {
    expect(visemeOffset(VISEMES.length)).toEqual(visemeOffset(0));
    expect(visemeOffset(-1)).toEqual(visemeOffset(VISEMES.length - 1));
  });
});

describe('buildMouthGeometry', () => {
  const card = mouthCardFor('zara');

  it('has a card for the piloted character', () => {
    expect(card).not.toBeNull();
  });

  it('refuses a grid whose positions do not match its dimensions', () => {
    expect(() => buildMouthGeometry({ cols: 3, rows: 3, positions: [[0, 0, 0]] })).toThrow(
      /expected 9 positions/,
    );
  });

  it('builds two triangles per grid cell', () => {
    const geometry = buildMouthGeometry(card!);
    const quads = (card!.cols - 1) * (card!.rows - 1);
    expect(geometry.getIndex()?.count).toBe(quads * 6);
  });

  it('spans the full 0..1 UV cell so the texture offset picks the frame', () => {
    const geometry = buildMouthGeometry(card!);
    const uv = geometry.getAttribute('uv');
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (let index = 0; index < uv.count; index += 1) {
      minU = Math.min(minU, uv.getX(index));
      maxU = Math.max(maxU, uv.getX(index));
      minV = Math.min(minV, uv.getY(index));
      maxV = Math.max(maxV, uv.getY(index));
    }
    expect([minU, maxU, minV, maxV]).toEqual([0, 1, 0, 1]);
  });

  it('is not a flat plane — it is fitted to the face', () => {
    // The whole reason the geometry is baked instead of being a quad: the face
    // curves across the mouth, and a flat card stands off the cheek at its
    // corners. If this ever collapses to one depth, the fit has been lost.
    const geometry = buildMouthGeometry(card!);
    const position = geometry.getAttribute('position');
    const depths: number[] = [];
    for (let index = 0; index < position.count; index += 1) depths.push(position.getZ(index));
    const spread = Math.max(...depths) - Math.min(...depths);
    expect(spread).toBeGreaterThan(0.005);
  });
});

describe('toHeadLocal', () => {
  it('places the card relative to the head joint, whatever the model’s scale', () => {
    /*
     * The exports carry a 0.01 armature scale, which is exactly what broke the
     * bind-matrix route this replaced. A head joint parked at a scaled,
     * translated world transform must still receive a local offset that lands
     * the card back where the model-space point asked for.
     */
    const root = new Object3D();
    const armature = new Object3D();
    armature.scale.setScalar(0.01);
    root.add(armature);
    const head = new Bone();
    head.position.set(0, 130, 0); // metres × the 0.01 scale ⇒ 1.30 m up
    armature.add(head);
    root.updateMatrixWorld(true);

    const geometry = new BufferGeometry();
    // A point 1.30 m up and 0.2 m forward, in the model's own metre space.
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 1.3, 0.2]), 3));
    toHeadLocal(geometry, head, root);

    // Re-applying the head's world matrix must return the original world point.
    const back = new Vector3().fromBufferAttribute(
      geometry.getAttribute('position') as BufferAttribute,
      0,
    );
    back.applyMatrix4(head.matrixWorld);
    expect(back.x).toBeCloseTo(0, 5);
    expect(back.y).toBeCloseTo(1.3, 5);
    expect(back.z).toBeCloseTo(0.2, 5);
  });

  it('stays correct after the head is posed, because the face does not deform', () => {
    const root = new Object3D();
    const head = new Bone();
    head.position.set(0, 1.3, 0);
    root.add(head);
    root.updateMatrixWorld(true);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 1.35, 0.2]), 3));
    toHeadLocal(geometry, head, root);
    const local = new Vector3().fromBufferAttribute(
      geometry.getAttribute('position') as BufferAttribute,
      0,
    );

    // Turn the head. The card is parented to it, so the OFFSET must not change.
    head.rotation.y = 0.7;
    head.updateMatrixWorld(true);
    const after = local.clone().applyMatrix4(head.matrixWorld);
    const expected = new Vector3(0, 0.05, 0.2).applyMatrix4(head.matrixWorld);
    expect(after.distanceTo(expected)).toBeCloseTo(0, 5);
  });
});

describe('mouthAtlasUrl', () => {
  it('sits beside the .glb it belongs to', () => {
    expect(mouthAtlasUrl('/scenes', 'zara')).toBe('/scenes/mouth/zara.png');
  });
});
