# Origin HTML Table Designer App

In a hurry? [Download the zipped App OPX file](https://github.com/ChrisDrozdowski/Origin-HTML-Table-Designer-App/raw/master/HTML%20Table%20Designer.zip), install the App, [watch this video](https://chrisdrozdowski.github.io/HTML%20Table%20Designer%20App.mp4).

Starting with Origin 2019b, you can create HTML-based documents and reports contained in Origin Notes windows. You can include automatically generated tables in these reports. This **HTML Table Designer** App *(Origin plugin)* allows you to easily style those tables without having to know CSS. It is a wholy independent, personal project.

This repository contains the source code for the App.

App usage instructions are available via a link at the top of the App dialog. ***Read it!!!***

## App Packaging Instructions

To generate an `OPX` file for this App, download or fork this repository and copy the [`HTML Table Designer`](HTML%20Table%20Designer) folder to your `C:\Users\[username]\AppData\Local\OriginLab\Apps` folder. In Origin, open the Command or Script Window, and run the following script:

```
run.file("%@AHTML Table Designer\package.ogs");
```

It will generate **`HTML Table Designer.opx`** containing all files currently in the folder packaged using settings in the `package.ini` file. The OPX will be output to your Origin `User Files` folder. You can then move that `OPX` file to the destination of your choice.

To install the App, simply drag and drop the OPX file into Origin.

## Reporting Issues and Feature Requests

Use GitHub's Issues tab to report issues and feature requests. Provide as much detail as possible to reproduce your issue. Feature requests and new styles are always welcome. However, this is an independent project and I can only work on it in my free time. So don't expect instant results.

## Authors

* [Chris Drozdowski](https://github.com/chrisdrozdowski)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Prior to contributing to this repository, including reporting issues, please refer to the [Contributing](CONTRIBUTING.md) page.
