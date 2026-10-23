"use client";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="button-primary">Print transcript</button>;
}
