import Models = require("../share/models");

export class Publisher {
  constructor(
    private _dbSize,
    private _socket,
    private _evOn,
    private _delayUI,
    private _o60,
    public registerSnapshot,
    public registerReceiver,
    public publish,
  ) {
    this.setTick();
    this._evOn('QuotingParameters', (qp) => {
      this._delayUI = qp.delayUI;
      this.setTick();
    });

    this.registerSnapshot(Models.Topics.ApplicationState, () => [this._app_state]);

    this.registerSnapshot(Models.Topics.Notepad, () => [this._notepad]);

    this.registerSnapshot(Models.Topics.ToggleConfigs, () => [this._toggleConfigs]);

    this.registerReceiver(Models.Topics.Notepad, (notepad: string) => {
      this._notepad = notepad;
    });

    this.registerReceiver(Models.Topics.ToggleConfigs, (toggleConfigs: boolean) => {
      this._toggleConfigs = toggleConfigs;
    });
  }

  private _app_state: Models.ApplicationState;
  private _notepad: string;
  private _toggleConfigs: boolean = true;
  private _tick: number = 0;
  private _interval = null;

  private onTick = () => {
    this._tick = 0;
    this._app_state = new Models.ApplicationState(
      process.memoryUsage().rss,
      (new Date()).getHours(),
      this._o60(),
      this._dbSize()
    );
    this._o60(true);
    this.publish(Models.Topics.ApplicationState, this._app_state);
  };

  private onDelay = () => {
    this._tick += this._delayUI;
    if (this._tick>=6e1) this.onTick();
    let orders: any[] = this._delayed.filter(x => x[0]===Models.Topics.OrderStatusReports);
    this._delayed = this._delayed.filter(x => x[0]!==Models.Topics.OrderStatusReports);
    if (orders.length) this._delayed.push([Models.Topics.OrderStatusReports, orders.map(x => x[1])]);
    this._delayed.forEach(x => this._socket.uiUp(x[0], x[1]));
    this._delayed = orders.filter(x => x[1].orderStatus===Models.OrderStatus.Working);
  };

  private setTick = () => {
    if (this._interval) clearInterval(this._interval);
    if (this._delayUI<1) this._delayUI = 0;
    this._delayed = [];
    this._interval = setInterval(
      this._delayUI ? this.onDelay : this.onTick,
      (this._delayUI || 6e1) * 1e3
    );
    this.onTick();
  };
}
