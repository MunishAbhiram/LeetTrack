export default function RoadmapPage({ params }: { params: { name: string } }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Roadmap: {params.name}</h1>
      <p className="text-muted-foreground">Coming in Stage 6.</p>
    </div>
  );
}
