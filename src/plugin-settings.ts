export class PluginSettings {
  /**
   * The relation registry, one definition per line: `label <-> inverse` for a pair, `label <-> label` for a
   * symmetric label, a lone `label` for a label with no inverse, `label = step -> step | step` for a composition
   * rule.
   */
  public relationDefinitions: string[] = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling'];
}
