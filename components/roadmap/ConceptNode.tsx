import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { ConceptNodeData } from '@/types';
import styles from './ConceptNode.module.css';

interface ConceptNodeProps {
  data: ConceptNodeData;
}

const ConceptNode = ({ data }: ConceptNodeProps) => {
  const impClass = data.importance ? styles[data.importance] : '';

  const handleClick = () => {
    if (data.conceptUrl) {
      window.open(data.conceptUrl, '_blank');
    }
  };

  return (
    <div className={`${styles.node} ${impClass}`} onClick={handleClick}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      
      <div className={styles.iconWrapper}>
        <BookOpen size={18} />
      </div>
      
      <div className={styles.content}>
        <h4 className={styles.title}>{data.label}</h4>
        <span className={styles.sub}>Kavram / Döküman</span>
      </div>

      {data.conceptUrl && (
        <ExternalLink size={14} color="var(--color-text-tertiary)" />
      )}

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
};

export default memo(ConceptNode);
