interface ProvisionerOptions {
    workspaceRoot: string;
    presetsDir: string;
    palettesDir: string;
}
interface EntityDef {
    name: string;
    slug: string;
    fields: string[];
}
interface ProvisionInput {
    runId: string;
    preset: string;
    palette: string;
    entities?: EntityDef[];
}
export declare class Provisioner {
    private workspaceRoot;
    private presetsDir;
    private palettesDir;
    constructor(options: ProvisionerOptions);
    create(input: ProvisionInput): Promise<string>;
    private generateEntitySkeletons;
    private generateListPage;
    private generateDetailPage;
    private generateFormPage;
    private generateEditPage;
    private getRealisticSampleData;
    private generateGenericValue;
    private generateSeedRoute;
    private updateAdminLayout;
    private installPlaywrightBrowser;
    private generateTemplateE2ETests;
    private toFieldKey;
}
export {};
