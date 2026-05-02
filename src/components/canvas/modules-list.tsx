'use client';

import { useEffect, useState } from 'react';
import type { CourseModule as CanvasModule, CourseModuleItem as CanvasModuleItem } from '@/lib/course-modules';

type CanvasModulesListProps = {
  courseId: string;
  modules: CanvasModule[];
};

function IconChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`canvas-inline-icon canvas-inline-icon--chevron ${expanded ? 'is-expanded' : ''}`}>
      <path d="m5.2 2.8 5 5.2-5 5.2-1.1-1.1L8 8 4.1 3.9z" fill="currentColor" />
    </svg>
  );
}

function ModuleStatusIcon({ state }: { state: CanvasModule['state'] }) {
  if (state === 'complete') return <span className="canvas-status-icon canvas-status-icon--complete" aria-hidden>✓</span>;
  if (state === 'locked') return <span className="canvas-status-icon canvas-status-icon--locked" aria-hidden>🔒</span>;
  return <span className="canvas-status-icon canvas-status-icon--current" aria-hidden>•</span>;
}

function ModuleItemTypeIcon({ item }: { item: CanvasModuleItem }) {
  const icon = {
    wiki_page: '📄',
    discussion_topic: '💬',
    assignment: '📝',
    attachment: '📎',
    quiz: '☑',
  }[item.type];

  return <span aria-hidden className="canvas-module-item-icon-glyph">{icon}</span>;
}

export default function CanvasModulesList({ courseId, modules }: CanvasModulesListProps) {
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsedModules({});
  }, [courseId, modules]);

  const collapsedCount = Object.values(collapsedModules).filter(Boolean).length;
  const allCollapsed = modules.length > 0 && collapsedCount === modules.length;

  function toggleAll() {
    setCollapsedModules(
      allCollapsed
        ? {}
        : Object.fromEntries(modules.map((module) => [module.id, true])),
    );
  }

  function toggleModule(moduleId: string) {
    setCollapsedModules((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  }

  return (
    <>
      <h1 className="context-modules-title screenreader-only">Course Modules</h1>
      <div className="header-bar">
        <div className="header-bar-right header-bar__module-layout">
          <div className="header-bar-right__buttons">
            <button className="btn" id="expand_collapse_all" aria-expanded={!allCollapsed} data-expand={!allCollapsed} type="button" onClick={toggleAll}>
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          </div>
        </div>
      </div>

      <div className="item-group-container" id="context_modules_sortable_container">
        <div className="module-selector-container" />
        <div id="context_modules" aria-label="Course Modules" className="ig-list">
          {modules.map((module) => {
            const collapsed = Boolean(collapsedModules[module.id]);

            return (
              <section
                key={module.id}
                className={`item-group-condensed context_module student-view context_module_hover ${module.state === 'complete' ? 'completed' : ''}`}
                aria-label={module.name}
                data-workflow-state="active"
                data-module-url={`/courses/${courseId}/modules/${module.id}`}
                data-module-id={module.id}
                id={`context_module_${module.id}`}
              >
                <a id={`module_${module.id}`} />
                <div className="ig-header header" id={module.id}>
                  <h2 className="screenreader-only">{module.name}</h2>
                  <button
                    type="button"
                    className="ig-header-title collapse_module_link ellipsis"
                    aria-controls={`context_module_content_${module.id}`}
                    aria-expanded={!collapsed}
                    aria-label={`${module.name} toggle module visibility`}
                    title={module.name}
                    onClick={() => toggleModule(module.id)}
                  >
                    <IconChevron expanded={!collapsed} />
                    <span className="name">{module.name}</span>
                  </button>

                  <div className="module_header_items">
                    <div className="ig-header-admin">
                      <div className="completion_status">
                        <ModuleStatusIcon state={module.state} />
                        <span className="screenreader-only">
                          {module.state === 'complete' ? 'Module Completed' : module.state === 'locked' ? 'Module Locked' : 'Module In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`content ${collapsed ? 'is-collapsed' : ''}`} id={`context_module_content_${module.id}`}>
                  <ul className="ig-list items context_module_items">
                    {module.items.length ? module.items.map((item) => (
                      <li
                        key={item.id}
                        id={`context_module_item_${item.id}`}
                        className={`context_module_item student-view ${item.type} indent_0 _requirement rendered`}
                      >
                        <div className="ig-row ig-published student-view no-estimated-duration">
                          <span className="type_icon" title={item.typeLabel} role="none">
                            <span className="screenreader-only">{item.typeLabel}</span>
                            <span className="ig-type-icon" aria-hidden="true">
                              <ModuleItemTypeIcon item={item} />
                            </span>
                          </span>

                          <div className="ig-info">
                            <div className="module-item-title">
                              <span className="item_name">
                                <span title={item.title} className="ig-title title item_link" aria-describedby={`module-item-${item.id}-details`}>
                                  {item.title}
                                </span>
                                <span className="points_possible" style={{ display: 'none' }}>
                                  {item.points ?? '\u00a0'}
                                </span>
                              </span>
                            </div>

                            <div className="module_item_icons nobr">
                              <span className="type" style={{ display: 'none' }}>
                                {item.type}
                              </span>
                              <span className="id" style={{ display: 'none' }}>
                                {item.id}
                              </span>
                              <span className="graded" style={{ display: 'none' }}>
                                {item.points ? '1' : '0'}
                              </span>
                            </div>

                            <div id={`module-item-${item.id}-details`} className="ig-details">
                              <div className="requirement-description ig-details__item">
                                <span className="completion_requirement">
                                  {item.meta || 'View'}
                                </span>
                              </div>
                              {item.points ? <div className="estimated_duration_display ig-details__item">{item.points} pts</div> : null}
                            </div>
                          </div>
                          <div className="module-item-status-icon" />
                        </div>
                      </li>
                    )) : (
                      <li className="context_module_item student-view rendered">
                        <div className="ig-row ig-published student-view no-estimated-duration">
                          <div className="ig-info">
                            <div className="module-item-title">
                              <span className="item_name">
                                <span className="ig-title title item_link text-neutral-500">No imported items in this week yet</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
