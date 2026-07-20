import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lightbulb } from 'lucide-react';
import { NoteNodeData } from '@/types';
import styles from './NoteNode.module.css';

interface NoteNodeProps {
  data: NoteNodeData;
}

const NoteNode = ({ data }: NoteNodeProps) => {
  const impClass = data.importance ? styles[data.importance] : '';

  return (
    <div className={`${styles.node} ${impClass}`}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      
      <div className={styles.header}>
        <Lightbulb size={16} className={styles.icon} />
        <h4 className={styles.title}>{data.label}</h4>
      </div>
      
      {data.noteText && (
        <p className={styles.text}>{data.noteText}</p>
      )}

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
};

export default memo(NoteNode);
