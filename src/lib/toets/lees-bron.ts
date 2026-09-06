export async function leesBronBestand(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (
    name.endsWith(".docx") ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value.trim();
  }
  return (await file.text()).trim();
}
