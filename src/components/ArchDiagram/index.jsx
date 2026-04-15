import React from 'react';
import styles from './styles.module.css';

export default function ArchDiagram({ src, caption, alt }) {
  return (
    <figure className={styles.figure}>
      <a href={src} target="_blank" rel="noopener noreferrer" className={styles.link}>
        <img
          src={src}
          alt={alt || caption || 'Architecture diagram'}
          className={styles.diagram}
        />
        <span className={styles.zoomHint}>Click to view full size ↗</span>
      </a>
      {caption && (
        <figcaption className={styles.caption}>{caption}</figcaption>
      )}
    </figure>
  );
}
