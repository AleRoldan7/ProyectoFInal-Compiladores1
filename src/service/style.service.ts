import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StyleService {

  private readonly LOCAL_KEY = 'proyectos_styles';

  applyStyles(cssText: string, projectName?: string) {
    const id = this.styleElementId(projectName);
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.innerHTML = cssText || '';
  }

  removeStyles(projectName?: string) {
    const id = this.styleElementId(projectName);
    const el = document.getElementById(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  saveStyleLocal(projectName: string, cssText: string) {
    const map = this.getAllStyles();
    map[projectName] = cssText;
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(map));
  }

  getStyleLocal(projectName: string): string | null {
    const map = this.getAllStyles();
    return map[projectName] ?? null;
  }

  getAllStyles(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(this.LOCAL_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  activateStyleForProject(projectName: string) {
    const css = this.getStyleLocal(projectName);
    if (css) this.applyStyles(css, projectName);
  }

  private styleElementId(projectName?: string) {
    return projectName ? `styles-${projectName}` : 'styles-global';
  }

}
