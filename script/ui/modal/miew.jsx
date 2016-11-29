import { h, Component, render } from 'preact';
/** @jsx h */

import Dialog from '../component/dialog';

const MIEW_PATH = '__MIEW_PATH__';
const MIEW_OPTIONS = {
	preset: 'small',
	settings: {
		theme: 'light',
		atomLabel: 'bright',
		autoPreset: false,
		inversePanning: true
	},
	reps: [{
		mode: 'LN',
		colorer: 'AT',
		selector: 'all'
	}]
};
const MIEW_WINDOW = {
	location: 'no',
	menubar: 'no',
	toolbar: 'no',
	directories: 'no',
	modal: 'yes',
	alwaysRaised: 'yes'
};

function origin (url) {
	var loc = url;
	if (!loc.href) {
		loc = document.createElement('a');
		loc.href = url;
	}
	if (loc.origin)
		return loc.origin;
	if (!loc.hostname) // relative url, IE
		loc = document.location;
	return loc.protocol  + '//' + loc.hostname +
		   (!loc.port ? '' : ':' + loc.port);
}

function queryOptions(options, sep='&') {
	if (Array.isArray(options)) {
		return options.reduce((res, item) => {
			let value = queryOptions(item);
			if (value !== null)
				res.push(value);
			return res;
		}, []).join(sep);
	} else if (typeof options == 'object') {
		return Object.keys(options).reduce((res, item) => {
			let value = options[item];
			res.push(typeof value == 'object' ?
					 queryOptions(value) :
					 encodeURIComponent(item) + '=' +
					 encodeURIComponent(value));
			return res;
		}, []).join(sep);
	} else {
		return null;
	}
}

function miewLoad(wnd, url, options={}) { // TODO: timeout
	return new Promise(function (resolve, reject) {
		window.addEventListener('message', function onload(event) {
			if (event.origin == origin(url) && event.data == 'miewLoadComplete') {
				window.removeEventListener('message', onload);
				let miew = wnd.MIEWS[0];
				miew._opts.load = false; // setOptions({ load: '' })
				miew._menuDisabled = true; // no way to disable menu after constructor return
				if (miew.init()) {
					miew.setOptions(options);
					miew.benchmarkGfx().then(() => {
						miew.run();
						setTimeout(() => resolve(miew), 10);
						// see setOptions message handler
					});
				}
			}
		});
	});
}

function miewSave(miew, url) {
	miew.saveData();
	return new Promise(function (resolve, reject) {
		window.addEventListener('message', function onsave(event) {
			if (event.origin == origin(url) && event.data.startsWith('CML:')) {
				window.removeEventListener('message', onsave);
				resolve(atob(event.data.slice(4)));
			}
		});
	});
}

class Miew extends Component {
	constructor(props) {
		console.info('init');
		super(props);
	}
	load(ev) {
		let miew = miewLoad(ev.target.contentWindow,
							MIEW_PATH, MIEW_OPTIONS);
		this.setState({ miew });
		this.state.miew.then(miew => {
			miew.parse(this.props.structStr, {
				fileType: 'cml',
				loaded: true
			});
			this.setState({ miew });
		});
	}
	save(ev) {
		if (this.props.onOk) {
			let structStr = miewSave(this.state.miew, MIEW_PATH);
			this.setState({ structStr });
			this.state.structStr.then(structStr => {
				this.props.onOk({ structStr });
			});
		};
	}
	window() {
		let opts = {
			...MIEW_OPTIONS,
			load: `CML:${btoa(this.props.structStr)}`,
			sourceType: 'message'
		};
		let br = this.base.getBoundingClientRect(); // Preact specifiec
		                                            // see: epa.ms/1NAYWp
		let wndProps = {
			...MIEW_WINDOW,
			top: Math.round(br.top),
			left: Math.round(br.left),
			width: Math.round(br.width),
			height: Math.round(br.height)
		};
		let wnd = window.open(`${MIEW_PATH}?${queryOptions(opts)}`,
		                      'miew', queryOptions(wndProps, ','));
		if (wnd) {
			this.props.onCancel && this.props.onCancel();
			wnd.onload = function () {
				console.info('windowed');
			};
		};
	}
	render(props) {
		let {miew, structStr} = this.state;
		return (
			<Dialog caption="3D View"
					name="miew" params={props}
					buttons={[
						"Close",
						<button disabled={miew instanceof Promise || structStr instanceof Promise}
								onClick={ ev => this.save(ev) }>
						  Apply
						</button>,
						<button className="window"
								onClick={ ev => this.window() }>
							Detach to new window
						</button>
					]}>
				<iframe id="miew-iframe"
						src={MIEW_PATH}
						onLoad={ev => this.load(ev) }></iframe>
			</Dialog>
		);
	}
}

export default function dialog(params) {
	var overlay = $$('.overlay')[0];
	return render((
		<Miew {...params}/>
	), overlay);
};
