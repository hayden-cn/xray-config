import { Tag, Typography } from "antd";
import { sectionUri } from "../schema";
import { useMarkers } from "./useMarkers";
import SectionEditor from "./SectionEditor";

interface SectionCardProps {
  path: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

export default function SectionCard({ path, label, value, onChange }: SectionCardProps) {
  const markers = useMarkers(sectionUri(path));
  const errors = markers.filter((m) => m.severity === 8).length;

  return (
    <div className="section-card">
      <div className="section-card-head">
        <Typography.Text strong>{label}</Typography.Text>
        {errors > 0 && <Tag color="error">{errors}</Tag>}
      </div>
      <div className="section-card-editor">
        <SectionEditor path={path} value={value} onChange={onChange} />
      </div>
    </div>
  );
}
