export class PluginSettings {
  /**
   * The ids of the bundled presets whose registry lines are read after {@link PluginSettings.relationDefinitions}.
   */
  public includedPresets: string[] = [];

  /**
   * The relation registry, one definition per line: `label <-> inverse` for a pair, `label <-> label` for a
   * symmetric label, a lone `label` for a label with no inverse, `label = step -> step[!property] | step except label`
   * for a composition rule, `label < superLabel` for a sub-label, `label @ property: value -> variant` for label variants.
   */
  public relationDefinitions: string[] = ['parent <-> child', 'spouse <-> spouse', 'sibling <-> sibling'];
}
